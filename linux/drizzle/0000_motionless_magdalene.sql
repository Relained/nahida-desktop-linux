CREATE TABLE `app_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_paths` (
	`game` text PRIMARY KEY NOT NULL,
	`modFolderPath` text NOT NULL,
	`importer` text
);
--> statement-breakpoint
CREATE TABLE `image_cache` (
	`hash` text PRIMARY KEY NOT NULL,
	`image` blob NOT NULL,
	`size` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mod_preset_items` (
	`preset_id` text NOT NULL,
	`mod_key` text NOT NULL,
	`relative_path` text NOT NULL,
	`group_relative_path` text NOT NULL,
	`folder_name` text NOT NULL,
	`is_enabled` integer NOT NULL,
	`item_order` integer NOT NULL,
	PRIMARY KEY(`preset_id`, `mod_key`),
	FOREIGN KEY (`preset_id`) REFERENCES `mod_presets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mod_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`game` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`game`) REFERENCES `game_paths`(`game`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mod_presets_game_name_idx` ON `mod_presets` (`game`,`name`);--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
