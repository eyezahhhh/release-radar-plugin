CREATE TABLE `discovered_artists` (
	`identity_id` text NOT NULL,
	`identity` text NOT NULL,
	PRIMARY KEY(`identity_id`, `identity`)
);
--> statement-breakpoint
CREATE TABLE `discovered_ephemeral_album_artists` (
	`album_plugin_id` text NOT NULL,
	`album_identity_id` text NOT NULL,
	`album_identity` text NOT NULL,
	`artist_identity_id` text NOT NULL,
	`artist_identity` text NOT NULL,
	PRIMARY KEY(`album_plugin_id`, `album_identity_id`, `album_identity`, `artist_identity_id`, `artist_identity`),
	FOREIGN KEY (`album_plugin_id`,`album_identity_id`,`album_identity`) REFERENCES `discovered_ephemeral_albums`(`plugin_id`,`identity_id`,`identity`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artist_identity_id`,`artist_identity`) REFERENCES `discovered_artists`(`identity_id`,`identity`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_album_artists_artist` ON `discovered_ephemeral_album_artists` (`artist_identity_id`,`artist_identity`);--> statement-breakpoint
CREATE TABLE `discovered_ephemeral_albums` (
	`plugin_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`identity` text NOT NULL,
	`date_discovered` integer NOT NULL,
	PRIMARY KEY(`plugin_id`, `identity_id`, `identity`)
);
