import { Identity } from "@pipe-bomb/plugin-sdk";
import { and, desc, eq, gte, or } from "drizzle-orm";
import { DBClient } from "./client.js";
import * as Schema from "./schema.js";

export interface AlbumInsertRow extends Identity {
	releaseDate?: number | null;
}

export class DatabaseManager {
	constructor(private readonly client: DBClient) {}

	public async addAlbums(albums: AlbumInsertRow[], artist: Identity) {
		if (!albums.length) {
			return;
		}

		const dateDiscovered = Date.now();

		this.client.transaction((tx) => {
			tx.insert(Schema.discoveredArtists)
				.values({
					identityId: artist.identityId,
					identity: artist.identity,
				})
				.onConflictDoNothing()
				.run();

			tx.insert(Schema.discoveredEphemeralAlbums)
				.values(
					albums.map(({ pluginId, identityId, identity, releaseDate }) => ({
						pluginId,
						identityId,
						identity,
						dateDiscovered: releaseDate ?? dateDiscovered,
					})),
				)
				.onConflictDoNothing()
				.run();

			tx.insert(Schema.discoveredEphemeralAlbumArtists)
				.values(
					albums.map(({ pluginId, identityId, identity }) => ({
						albumPluginId: pluginId,
						albumIdentityId: identityId,
						albumIdentity: identity,
						artistIdentityId: artist.identityId,
						artistIdentity: artist.identity,
					})),
				)
				.onConflictDoNothing()
				.run();
		});
	}

	public async getAlbumsByArtist(artists: Identity[]) {
		if (artists.length === 0) return [];

		const matches = artists.map(({ identityId, identity }) =>
			and(
				eq(Schema.discoveredEphemeralAlbumArtists.artistIdentityId, identityId),
				eq(Schema.discoveredEphemeralAlbumArtists.artistIdentity, identity),
			),
		);

		return this.client
			.selectDistinct({
				pluginId: Schema.discoveredEphemeralAlbums.pluginId,
				identityId: Schema.discoveredEphemeralAlbums.identityId,
				identity: Schema.discoveredEphemeralAlbums.identity,
				dateDiscovered: Schema.discoveredEphemeralAlbums.dateDiscovered,
			})
			.from(Schema.discoveredEphemeralAlbumArtists)
			.innerJoin(
				Schema.discoveredEphemeralAlbums,
				and(
					eq(
						Schema.discoveredEphemeralAlbumArtists.albumPluginId,
						Schema.discoveredEphemeralAlbums.pluginId,
					),
					eq(
						Schema.discoveredEphemeralAlbumArtists.albumIdentityId,
						Schema.discoveredEphemeralAlbums.identityId,
					),
					eq(
						Schema.discoveredEphemeralAlbumArtists.albumIdentity,
						Schema.discoveredEphemeralAlbums.identity,
					),
				),
			)
			.where(or(...matches));
	}

	public async getNewAlbumsByArtist(artists: Identity[]) {
		if (artists.length === 0) return [];

		const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

		const matches = artists.map(({ identityId, identity }) =>
			and(
				eq(Schema.discoveredEphemeralAlbumArtists.artistIdentityId, identityId),
				eq(Schema.discoveredEphemeralAlbumArtists.artistIdentity, identity),
			),
		);

		return this.client
			.selectDistinct({
				pluginId: Schema.discoveredEphemeralAlbums.pluginId,
				identityId: Schema.discoveredEphemeralAlbums.identityId,
				identity: Schema.discoveredEphemeralAlbums.identity,
				dateDiscovered: Schema.discoveredEphemeralAlbums.dateDiscovered,
			})
			.from(Schema.discoveredEphemeralAlbumArtists)
			.innerJoin(
				Schema.discoveredEphemeralAlbums,
				and(
					eq(
						Schema.discoveredEphemeralAlbumArtists.albumPluginId,
						Schema.discoveredEphemeralAlbums.pluginId,
					),
					eq(
						Schema.discoveredEphemeralAlbumArtists.albumIdentityId,
						Schema.discoveredEphemeralAlbums.identityId,
					),
					eq(
						Schema.discoveredEphemeralAlbumArtists.albumIdentity,
						Schema.discoveredEphemeralAlbums.identity,
					),
				),
			)
			.where(
				and(
					or(...matches),
					gte(Schema.discoveredEphemeralAlbums.dateDiscovered, cutoff),
				),
			)
			.orderBy(desc(Schema.discoveredEphemeralAlbums.dateDiscovered))
			.limit(20);
	}
}
