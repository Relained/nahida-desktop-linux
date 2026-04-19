import { integer, primaryKey, sqliteTable, text, uniqueIndex, blob } from "drizzle-orm/sqlite-core";

export const setting = sqliteTable("setting", {
    key: text().primaryKey(),
    value: text(),
});

export const appState = sqliteTable("app_state", {
    key: text().primaryKey(),
    value: text().notNull(),
    updatedAt: text("updated_at").notNull(),
});

export const gamePaths = sqliteTable("game_paths", {
    game: text().primaryKey(),
    modFolderPath: text().notNull(),
    importer: text(),
});

export const modPresets = sqliteTable(
    "mod_presets",
    {
        id: text().primaryKey(),
        game: text()
            .notNull()
            .references(() => gamePaths.game, { onDelete: "cascade" }),
        name: text().notNull(),
        description: text(),
        itemCount: integer("item_count").notNull().default(0),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
        version: integer().notNull().default(1),
    },
    (t) => [uniqueIndex("mod_presets_game_name_idx").on(t.game, t.name)],
);

export const modPresetItems = sqliteTable(
    "mod_preset_items",
    {
        presetId: text("preset_id")
            .notNull()
            .references(() => modPresets.id, { onDelete: "cascade" }),
        modKey: text("mod_key").notNull(),
        relativePath: text("relative_path").notNull(),
        groupRelativePath: text("group_relative_path").notNull(),
        folderName: text("folder_name").notNull(),
        isEnabled: integer("is_enabled", { mode: "boolean" }).notNull(),
        itemOrder: integer("item_order").notNull(),
    },
    (t) => [primaryKey({ columns: [t.presetId, t.modKey] })],
);

export const imageCache = sqliteTable("image_cache", {
    hash: text().primaryKey(),
    image: blob({ mode: "buffer" }).notNull(),
    size: integer().notNull(),
});
