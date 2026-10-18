import {
	AttributeValue,
	DataClient,
	EphemeralAlbumContent,
	EphemeralSourceInfo,
	EphemeralTrack,
	Logger,
	SavedArtist,
	SavedAttribute,
	TaskRunContext,
	WritablePlaylistClient,
} from "@pipe-bomb/plugin-sdk";
import { AlbumInsertRow, DatabaseManager } from "./db/database-manager.js";
import { DiscoveredEphemeralAlbum } from "./db/schema.js";
import { PlaylistAttributeSource } from "./playlist.attribute-source.js";
import { readFile } from "fs/promises";
import { getAssetPath, getAttribute, getDiscoveryDate } from "./util.js";

const MIN_PLAYLIST_LENGTH = 30;

interface RecentAlbum extends DiscoveredEphemeralAlbum {
	tracks: EphemeralTrack[];
}

export class ReleaseRadarManager {
	constructor(
		private readonly dataClient: DataClient,
		private readonly databaseManager: DatabaseManager,
		private readonly playlistClient: WritablePlaylistClient,
		private readonly getEphemeralArtistSource: (
			pluginId: string,
			identityId: string,
		) => EphemeralSourceInfo | null,
		private readonly getEphemeralAlbumSource: (
			pluginId: string,
			identityId: string,
		) => EphemeralSourceInfo | null,
		private readonly logger: Logger,
	) {}

	public async createPlaylists(ctx: TaskRunContext) {
		const userCount = await this.dataClient.getUserCount();

		const playlistUuids = await this.playlistClient.getBotPlaylistUuids(
			"release-radar",
			"release-radar",
		);
		const playlists = await this.playlistClient.getPlaylists(playlistUuids, {
			relations: {
				attributes: true,
			},
		});
		const userPlaylistIds = new Map<string, string>();
		for (const playlist of playlists) {
			const attribute = playlist.attributes?.find(
				(a) => a.key == "pipebomb_user_id" && a.type == "string",
			) as SavedAttribute<"string"> | undefined;
			if (!attribute?.values.length) {
				await this.playlistClient.deletePlaylist(playlist.uuid);
				continue;
			}
			const userId = attribute.values[0]!;
			userPlaylistIds.set(userId, playlist.uuid);
		}

		const checkedArtistUuids = new Set<string>();

		let userIndex = 0;
		const percentSlice = 1 / userCount;
		await this.dataClient.forEachUserId(async (userUuid) => {
			const startPercent = userIndex++ / userCount;
			ctx.update(startPercent);

			const artists: SavedArtist[] = [];
			for (let i = 0; true; i++) {
				const idChunk = await this.dataClient.getSavedArtistUuids(
					userUuid,
					1_000,
					1_000 * i,
				);

				if (idChunk.length) {
					const artistChunk = await this.dataClient.getArtists(
						idChunk.map(({ uuid }) => uuid),
						{
							relations: {
								identities: true,
							},
						},
					);
					artists.push(...artistChunk);
				}

				if (idChunk.length < 1_000) {
					break;
				}
			}

			if (!artists.length) {
				return;
			}

			this.logger.debug(
				`User "${userUuid}" has ${artists.length} saved artists`,
			);

			const allRecentAlbums: DiscoveredEphemeralAlbum[] = [];

			for (const [artistIndex, artist] of artists.entries()) {
				ctx.update(
					startPercent + (percentSlice / artists.length) * artistIndex,
				);
				if (!artist.identities?.length) {
					continue;
				}
				if (!checkedArtistUuids.has(artist.uuid)) {
					for (const identity of artist.identities) {
						const ephemeralSource = this.getEphemeralArtistSource(
							identity.pluginId,
							identity.identityId,
						);
						if (ephemeralSource) {
							// this.logger.debug(
							// 	`Found source "${ephemeralSource.source.id}" for artist!`,
							// );
							try {
								const content =
									await ephemeralSource.source.resolveArtistContent(
										identity.identityId,
										identity.identity,
									);

								const albums: AlbumInsertRow[] = [];
								for (const albumStub of content?.albums ?? []) {
									const ephemeralSource = this.getEphemeralAlbumSource(
										albumStub.pluginId,
										albumStub.identityId,
									);
									if (ephemeralSource) {
										const albumMeta = await ephemeralSource.source.resolveAlbum(
											albumStub.identityId,
											albumStub.identity,
										);
										if (albumMeta) {
											const releaseDate = getDiscoveryDate(
												albumMeta.attributes ?? [],
											);

											albums.push({
												pluginId: albumStub.pluginId,
												identityId: albumStub.identityId,
												identity: albumStub.identity,
												releaseDate,
											});
										}
									}
								}

								await this.databaseManager.addAlbums(albums, identity);
							} catch (e) {
								this.logger.error(
									`Failed to get artist content from "${ephemeralSource.sourceId}" for "${artist.uuid}":`,
									e,
								);
							}
						}
					}
					checkedArtistUuids.add(artist.uuid);
				}

				const recentAlbums = await this.databaseManager.getNewAlbumsByArtist(
					artist.identities,
				);
				allRecentAlbums.push(...recentAlbums);
			}

			allRecentAlbums.sort((a, b) => b.dateDiscovered - a.dateDiscovered);

			const usingAlbums: RecentAlbum[] = [];
			let trackCount = 0;

			for (
				let i = 0;
				i < allRecentAlbums.length && trackCount < MIN_PLAYLIST_LENGTH;
				i++
			) {
				const album = allRecentAlbums[i];
				if (!album) {
					continue;
				}
				const ephemeralSource = this.getEphemeralAlbumSource(
					album.pluginId,
					album.identityId,
				);
				if (ephemeralSource) {
					try {
						const metadata = await ephemeralSource.source.resolveAlbum(
							album.identityId,
							album.identity,
						);
						if (metadata) {
							if (
								metadata.attributes &&
								!getAttribute(
									metadata.attributes,
									"releaseradar_exclude",
									"boolean",
								)
							) {
								const content =
									await ephemeralSource.source.resolveAlbumContent(
										album.identityId,
										album.identity,
									);
								if (content?.tracks?.length) {
									usingAlbums.push({
										...album,
										tracks: content.tracks,
									});
									trackCount += content.tracks.length;
								}
							}
						}
					} catch (e) {
						this.logger.error(
							`Failed to resolve album ${album.pluginId}.${album.identityId}.${album.identity}:`,
							e,
						);
					}
				}
			}

			const trackUuids: string[] = [];

			for (const album of usingAlbums) {
				this.logger.debug(
					`Saving album ${album.pluginId}.${album.identityId}.${album.identity}`,
				);

				const albumUuid = await this.dataClient.saveAlbum(
					{
						pluginId: album.pluginId,
						identityId: album.identityId,
						identity: album.identity,
					},
					null,
				);

				if (albumUuid) {
					this.logger.debug(
						`Saved album  ${album.pluginId}.${album.identityId}.${album.identity}`,
					);

					const fullAlbum = await this.dataClient.getAlbum(albumUuid, {
						relations: {
							tracks: true,
						},
					});
					if (fullAlbum?.tracks) {
						this.logger.debug(`Album has ${fullAlbum.tracks.length} tracks`);
						trackUuids.push(
							...fullAlbum.tracks.map((track) => track.trackUuid),
						);
					}
				} else {
					this.logger.warn(
						`Failed to save album  ${album.pluginId}.${album.identityId}.${album.identity}`,
					);
				}
			}

			const attributes: AttributeValue[] = [
				{
					key: "pipebomb_user_id",
					value: userUuid,
				},
				{
					key: "title",
					value: "Release Radar",
				},
				{
					key: "thumb",
					value: {
						extension: "jpg",
						buffer: () => readFile(getAssetPath("release-radar.jpg")),
					},
				},
			];

			let playlistUuid = userPlaylistIds.get(userUuid);
			if (playlistUuid) {
				userPlaylistIds.delete(userUuid);
				await this.playlistClient.updatePlaylistVisibility(
					playlistUuid,
					"unlisted",
				);
				await this.playlistClient.updatePlaylistAttributes(
					playlistUuid,
					PlaylistAttributeSource.ID,
					attributes,
				);
			} else {
				playlistUuid = await this.playlistClient.createPlaylist({
					visibility: "unlisted",
					attributes: {
						sourceId: PlaylistAttributeSource.ID,
						attributes,
					},
				});
			}
			await this.playlistClient.addPlaylistMember(
				playlistUuid,
				userUuid,
				"viewer",
			);

			const fullPlaylist = await this.playlistClient.getPlaylist(playlistUuid, {
				relations: {
					tracks: true,
				},
			});
			if (fullPlaylist?.tracks?.length) {
				await this.playlistClient.removeFromPlaylist(
					playlistUuid,
					fullPlaylist.tracks.map(({ trackUuid }) => trackUuid),
				);
			}
			await this.playlistClient.addToPlaylist(playlistUuid, trackUuids);
		});
	}
}
