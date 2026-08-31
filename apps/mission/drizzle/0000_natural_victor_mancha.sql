CREATE TABLE `missions` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`signed_state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
