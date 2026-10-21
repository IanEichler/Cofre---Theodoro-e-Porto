import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  creator: text("creator").notNull(),
  created: integer("created").notNull(),
});
export const members = sqliteTable("members", {
  email: text("email").primaryKey(),
  userId: text("user_id").unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  totp: text("totp"),
  pending: text("pending"),
  lastStep: integer("last_step").notNull().default(-1),
  attempts: integer("attempts").notNull().default(0),
  lockedUntil: integer("locked_until").notNull().default(0),
  recovery: text("recovery"),
  passwordHash: text("password_hash"),
  inviteHash: text("invite_hash").unique(),
  inviteExpires: integer("invite_expires"),
  authVersion: integer("auth_version").notNull().default(0),
  created: integer("created").notNull(),
});
export const sessions = sqliteTable("sessions", {
  hash: text("hash").primaryKey(),
  userId: text("user_id").notNull(),
  expires: integer("expires").notNull(),
  stage: text("stage").notNull().default("legacy"),
  authVersion: integer("auth_version").notNull().default(-1),
});
export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  scope: text("scope").notNull(),
  vault: text("vault").notNull(),
  cipher: text("cipher").notNull(),
  created: integer("created").notNull(),
  updated: integer("updated").notNull(),
  deleted: integer("deleted"),
  version: integer("version").notNull().default(1),
});
export const favorites = sqliteTable("favorites", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  itemId: text("item_id").notNull(),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  time: integer("time").notNull(),
});

export const authLimits = sqliteTable("auth_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
