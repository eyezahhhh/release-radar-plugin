import { InferInsertModel, relations } from "drizzle-orm";
import {
	sqliteTable,
	text,
	integer,
	primaryKey,
	foreignKey,
	index,
} from "drizzle-orm/sqlite-core";

// export const discoveredAlbums = sqliteTable("discovered_albums", {
// 	uuid: text("uuid").primaryKey(),
// 	dateDiscovered: integer("date_discovered"),
// });

export const discoveredEphemeralAlbums = sqliteTable(
	"discovered_ephemeral_albums",
	{
		pluginId: text("plugin_id").notNull(),
		identityId: text("identity_id").notNull(),
		identity: text("identity").notNull(),
		dateDiscovered: integer("date_discovered").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.pluginId, table.identityId, table.identity],
		}),
	],
);

export const discoveredArtists = sqliteTable(
	"discovered_artists",
	{
		identityId: text("identity_id").notNull(),
		identity: text("identity").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.identityId, table.identity],
		}),
	],
);

export const discoveredEphemeralAlbumArtists = sqliteTable(
	"discovered_ephemeral_album_artists",
	{
		albumPluginId: text("album_plugin_id").notNull(),
		albumIdentityId: text("album_identity_id").notNull(),
		albumIdentity: text("album_identity").notNull(),
		artistIdentityId: text("artist_identity_id").notNull(),
		artistIdentity: text("artist_identity").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.albumPluginId,
				table.albumIdentityId,
				table.albumIdentity,
				table.artistIdentityId,
				table.artistIdentity,
			],
		}),
		foreignKey({
			columns: [
				table.albumPluginId,
				table.albumIdentityId,
				table.albumIdentity,
			],
			foreignColumns: [
				discoveredEphemeralAlbums.pluginId,
				discoveredEphemeralAlbums.identityId,
				discoveredEphemeralAlbums.identity,
			],
		}),
		foreignKey({
			columns: [table.artistIdentityId, table.artistIdentity],
			foreignColumns: [
				discoveredArtists.identityId,
				discoveredArtists.identity,
			],
		}),
		index("idx_album_artists_artist").on(
			table.artistIdentityId,
			table.artistIdentity,
		),
	],
);

// export type DiscoveredAlbum = InferInsertModel<typeof discoveredAlbums>;
export type DiscoveredEphemeralAlbum = InferInsertModel<
	typeof discoveredEphemeralAlbums
>;
