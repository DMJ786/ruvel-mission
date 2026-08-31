import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const missions = sqliteTable("missions", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  signedState: text("signed_state").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
