CREATE TABLE `admin_activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`details` text,
	`ip_address` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_admin_activity_logs_admin_id` ON `admin_activity_logs` (`admin_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_activity_logs_created_at` ON `admin_activity_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`last_login` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `goal_boosts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`date` integer NOT NULL,
	`description` text,
	`created_at` integer,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goal_savings_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`frequency` text NOT NULL,
	`is_active` integer DEFAULT true,
	`next_contribution_date` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`user_id` text NOT NULL,
	`payment_id` integer,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`items` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issued_at` integer NOT NULL,
	`due_at` integer NOT NULL,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `idx_invoices_user_id` ON `invoices` (`user_id`);--> statement-breakpoint
CREATE TABLE `midtrans_webhook_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`transaction_id` text,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`signature` text,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`whatsapp_number` text,
	`message` text NOT NULL,
	`status` text NOT NULL,
	`sent_at` integer NOT NULL,
	`error_message` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notification_logs_user_id` ON `notification_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_logs_type` ON `notification_logs` (`type`);--> statement-breakpoint
CREATE INDEX `idx_notification_logs_sent_at` ON `notification_logs` (`sent_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`subscription_id` integer,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`midtrans_transaction_id` text,
	`midtrans_order_id` text,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `user_subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_midtrans_order_id_unique` ON `payments` (`midtrans_order_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_user_id` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_status` ON `payments` (`status`);--> statement-breakpoint
CREATE INDEX `idx_payments_midtrans_order_id` ON `payments` (`midtrans_order_id`);--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`price_monthly` real NOT NULL,
	`price_yearly` real NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`features` text NOT NULL,
	`limits` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_plans_name_unique` ON `subscription_plans` (`name`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`data_type` text NOT NULL,
	`description` text,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_settings_key_unique` ON `system_settings` (`key`);--> statement-breakpoint
CREATE TABLE `usage_tracking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`feature` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`period` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_usage_tracking_user_period` ON `usage_tracking` (`user_id`,`period`);--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`billing_cycle` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`auto_renew` integer DEFAULT true,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_subscriptions_user_id` ON `user_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_subscriptions_status` ON `user_subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE `whatsapp_activation_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_activation_codes_code_unique` ON `whatsapp_activation_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_whatsapp_activation_codes_user_id` ON `whatsapp_activation_codes` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_whatsapp_activation_codes_code` ON `whatsapp_activation_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_whatsapp_activation_codes_expires_at` ON `whatsapp_activation_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `whatsapp_integrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`whatsapp_number` text NOT NULL,
	`display_name` text,
	`activated_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_whatsapp_integrations_user_id` ON `whatsapp_integrations` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_whatsapp_integrations_number` ON `whatsapp_integrations` (`whatsapp_number`);--> statement-breakpoint
ALTER TABLE `budgets` ADD `metadata` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `transaction_reminders` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `subscription_plan_id` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `subscription_status` text DEFAULT 'free';