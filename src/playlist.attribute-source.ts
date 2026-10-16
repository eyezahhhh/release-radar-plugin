import {
	AlbumInformationHelper,
	AlbumMetadata,
	ArtistInformationHelper,
	ArtistMetadata,
	AttributeSource,
	AttributeSourceApiContext,
	TrackAttributionHelper,
	TrackMetadata,
} from "@pipe-bomb/plugin-sdk";

export class PlaylistAttributeSource implements AttributeSource {
	static readonly ID = "playlist";
	readonly id = PlaylistAttributeSource.ID;

	enable(ctx: AttributeSourceApiContext): void {
		ctx.registerPlaylistAttributes([
			{
				type: "string",
				key: "pipebomb_user_id",
				supportsMultiple: false,
			},
			{
				type: "buffer",
				key: "thumb",
				supportsMultiple: false,
			},
			{
				type: "string",
				key: "title",
				supportsMultiple: false,
			},
		]);
	}

	getName(): string {
		return "Release Radar";
	}

	async getTrackAttributeValues(
		_helper: TrackAttributionHelper,
	): Promise<TrackMetadata> {
		return {
			artists: null,
			attributes: null,
		};
	}

	async getArtistAttributeValues(
		_helper: ArtistInformationHelper,
	): Promise<ArtistMetadata> {
		return {
			attributes: null,
		};
	}

	async getAlbumAttributeValues(
		_helper: AlbumInformationHelper,
	): Promise<AlbumMetadata> {
		return {
			artists: null,
			attributes: null,
		};
	}
}
