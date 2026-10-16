import type { Plugin, PluginApiContext } from "@pipe-bomb/plugin-sdk";
import { PlaylistManager } from "./playlist-manager.js";
import path from "path";
import { createDatabaseClient } from "./db/client.js";
import { DatabaseManager } from "./db/database-manager.js";
import { PlaylistAttributeSource } from "./playlist.attribute-source.js";

export default class ReleaseRadarPlugin implements Plugin {
	private api: PluginApiContext | null = null;

	async enable(api: PluginApiContext): Promise<void> {
		this.api = api;
		api.registerLanguageDirectory("lang");
		api.registerIconDirectory("icons");

		const cacheDir = await api.requestCacheDirectory();

		const dbFile = path.join(cacheDir, "database.sqlite");
		const dbClient = createDatabaseClient(dbFile);

		api.registerAttributeSource(new PlaylistAttributeSource());

		const databaseManager = new DatabaseManager(dbClient);

		const playlistManager = new PlaylistManager(
			api.getDataClient(),
			databaseManager,
			api.getPlaylistClient({
				id: "release-radar",
				name: "Release Radar",
			}),
			(pluginId, identityId) =>
				api.getEphemeralSourceByArtistIdentity(pluginId, identityId),
			(pluginId, identityId) =>
				api.getEphemeralSourceByAlbumIdentity(pluginId, identityId),
			api.getLogger(),
		);

		api.registerTask({
			id: "create-playlists",
			resumable: false,
			run: (ctx) => playlistManager.createPlaylists(ctx),
		});
	}

	disable() {
		this.api = null;
	}
}
