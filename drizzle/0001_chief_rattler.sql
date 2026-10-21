CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `members` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `members` ADD `invite_hash` text;--> statement-breakpoint
ALTER TABLE `members` ADD `invite_expires` integer;--> statement-breakpoint
ALTER TABLE `members` ADD `auth_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `members_invite_hash_unique` ON `members` (`invite_hash`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `stage` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `auth_version` integer DEFAULT -1 NOT NULL;