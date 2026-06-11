import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    guildId: text("guild_id").notNull(),
    name: text("name").notNull(),
    imageUrl: text("image_url").notNull(),
    r2Key: text("r2_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_bookmarks_name").on(table.name)]
);

export const temporaryCache = pgTable("temporary_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  data: text("data").notNull(),
  contentType: text("content_type").notNull(),
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type TemporaryCache = typeof temporaryCache.$inferSelect;
