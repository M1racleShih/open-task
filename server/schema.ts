import { pgTable, uuid, text, jsonb, boolean } from "drizzle-orm/pg-core";
import type { Role } from "../shared/model.js";
export const userTable = pgTable("users", {
  id: uuid().primaryKey(),
  username: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text("password_hash").notNull(),
  roles: jsonb().$type<Role[]>().notNull(),
  active: boolean().notNull().default(true),
});
