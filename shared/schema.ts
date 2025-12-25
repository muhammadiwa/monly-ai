import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
export const sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess").notNull(), // JSON as text in SQLite
    expire: integer("expire").notNull(), // Unix timestamp
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  password: text("password"), // For demo authentication
  googleId: text("google_id").unique(), // For Google OAuth
  subscriptionPlanId: integer("subscription_plan_id"),
  subscriptionStatus: text("subscription_status").default("free"),
  createdAt: integer("created_at"), // Unix timestamp
  updatedAt: integer("updated_at"), // Unix timestamp
});

// User preferences table
export const userPreferences = sqliteTable("user_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull().unique(),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("UTC"),
  language: text("language").notNull().default("en"), // 'en' or 'id'
  autoCategorize: integer("auto_categorize", { mode: 'boolean' }).default(true),
  transactionReminders: integer("transaction_reminders", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at"), // Unix timestamp
  updatedAt: integer("updated_at"), // Unix timestamp
});

// Notification logs table
export const notificationLogs = sqliteTable("notification_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // 'transaction_reminder', 'budget_alert', etc.
  whatsappNumber: text("whatsapp_number"),
  message: text("message").notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull(),
  sentAt: integer("sent_at").notNull(), // Unix timestamp
  errorMessage: text("error_message"),
  createdAt: integer("created_at"), // Unix timestamp
}, (table) => [
  index("idx_notification_logs_user_id").on(table.userId),
  index("idx_notification_logs_type").on(table.type),
  index("idx_notification_logs_sent_at").on(table.sentAt),
]);

// WhatsApp integrations table
export const whatsappIntegrations = sqliteTable("whatsapp_integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull(),
  whatsappNumber: text("whatsapp_number").notNull(),
  displayName: text("display_name"),
  activatedAt: integer("activated_at"), // Unix timestamp
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: integer("created_at"), // Unix timestamp
}, (table) => [
  index("idx_whatsapp_integrations_user_id").on(table.userId),
  index("idx_whatsapp_integrations_number").on(table.whatsappNumber),
]);

// WhatsApp activation codes table
export const whatsappActivationCodes = sqliteTable("whatsapp_activation_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull(),
  code: text("code").notNull().unique(),
  expiresAt: integer("expires_at").notNull(), // Unix timestamp
  usedAt: integer("used_at"), // Unix timestamp
  createdAt: integer("created_at"), // Unix timestamp
}, (table) => [
  index("idx_whatsapp_activation_codes_user_id").on(table.userId),
  index("idx_whatsapp_activation_codes_code").on(table.code),
  index("idx_whatsapp_activation_codes_expires_at").on(table.expiresAt),
]);

// Categories table
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  type: text("type").notNull(), // 'income' or 'expense'
  isDefault: integer("is_default", { mode: 'boolean' }).default(false),
  userId: text("user_id").references(() => users.id),
  createdAt: integer("created_at"), // Unix timestamp
});

// Transactions table
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  amount: real("amount").notNull(), // Use real for decimal numbers in SQLite
  currency: text("currency").notNull().default("USD"),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'income' or 'expense'
  date: integer("date").notNull(), // Unix timestamp
  receiptUrl: text("receipt_url"),
  aiGenerated: integer("ai_generated", { mode: 'boolean' }).default(false),
  createdAt: integer("created_at"), // Unix timestamp
  updatedAt: integer("updated_at"), // Unix timestamp
});

// Budgets table
export const budgets = sqliteTable("budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  amount: real("amount").notNull(), // Use real for decimal numbers in SQLite
  currency: text("currency").notNull().default("USD"),
  period: text("period").notNull(), // 'monthly', 'weekly', 'yearly'
  startDate: integer("start_date").notNull(), // Unix timestamp
  endDate: integer("end_date").notNull(), // Unix timestamp
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  metadata: text("metadata"), // JSON metadata for spending limits and other budget-related data
  createdAt: integer("created_at"), // Unix timestamp
  updatedAt: integer("updated_at"), // Unix timestamp
});

// Financial goals table
export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  targetAmount: real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  deadline: integer("deadline").notNull(), // Unix timestamp
  category: text("category"), // Optional category like 'emergency', 'vacation', etc.
  description: text("description"),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at"), // Unix timestamp
  updatedAt: integer("updated_at"), // Unix timestamp
});

// Goal boosts table - records one-time contributions to goals
export const goalBoosts = sqliteTable("goal_boosts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  goalId: integer("goal_id").references(() => goals.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  amount: real("amount").notNull(),
  date: integer("date").notNull(), // Unix timestamp
  description: text("description"),
  createdAt: integer("created_at"), // Unix timestamp
});

// Goal savings plans - automatic recurring contributions to goals
export const goalSavingsPlans = sqliteTable("goal_savings_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  goalId: integer("goal_id").references(() => goals.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  amount: real("amount").notNull(),
  frequency: text("frequency").notNull(), // 'weekly', 'biweekly', 'monthly'
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  nextContributionDate: integer("next_contribution_date"), // Unix timestamp
  createdAt: integer("created_at"), // Unix timestamp
  updatedAt: integer("updated_at"), // Unix timestamp
});

// Admin Panel Tables

// Admin users table
export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey().notNull(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  role: text("role", { enum: ["super_admin", "admin", "support"] }).notNull().default("admin"),
  lastLogin: integer("last_login"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// Subscription plans table
export const subscriptionPlans = sqliteTable("subscription_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  priceMonthly: real("price_monthly").notNull(),
  priceYearly: real("price_yearly").notNull(),
  currency: text("currency").notNull().default("IDR"),
  features: text("features").notNull(), // JSON array
  limits: text("limits").notNull(), // JSON object
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// User subscriptions table
export const userSubscriptions = sqliteTable("user_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull(),
  planId: integer("plan_id").references(() => subscriptionPlans.id).notNull(),
  status: text("status", { enum: ["active", "expired", "cancelled", "pending"] }).notNull().default("active"),
  billingCycle: text("billing_cycle", { enum: ["monthly", "yearly"] }).notNull(),
  startDate: integer("start_date").notNull(),
  endDate: integer("end_date").notNull(),
  autoRenew: integer("auto_renew", { mode: 'boolean' }).default(true),
  cancelledAt: integer("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_user_subscriptions_user_id").on(table.userId),
  index("idx_user_subscriptions_status").on(table.status),
]);

// Payments table
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull(),
  subscriptionId: integer("subscription_id").references(() => userSubscriptions.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  paymentMethod: text("payment_method", { enum: ["credit_card", "bank_transfer", "e_wallet", "other"] }).notNull(),
  status: text("status", { enum: ["pending", "paid", "failed", "refunded"] }).notNull().default("pending"),
  midtransTransactionId: text("midtrans_transaction_id"),
  midtransOrderId: text("midtrans_order_id").unique(),
  paidAt: integer("paid_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_payments_user_id").on(table.userId),
  index("idx_payments_status").on(table.status),
  index("idx_payments_midtrans_order_id").on(table.midtransOrderId),
]);

// Invoices table
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").unique().notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  paymentId: integer("payment_id").references(() => payments.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  items: text("items").notNull(), // JSON array
  status: text("status", { enum: ["draft", "sent", "paid", "cancelled"] }).notNull().default("draft"),
  issuedAt: integer("issued_at").notNull(),
  dueAt: integer("due_at").notNull(),
  paidAt: integer("paid_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_invoices_user_id").on(table.userId),
]);

// System settings table
export const systemSettings = sqliteTable("system_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  dataType: text("data_type", { enum: ["string", "number", "boolean", "json"] }).notNull(),
  description: text("description"),
  updatedBy: text("updated_by").references(() => adminUsers.id),
  updatedAt: integer("updated_at").notNull(),
});

// Admin activity log table
export const adminActivityLogs = sqliteTable("admin_activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  adminId: text("admin_id").references(() => adminUsers.id).notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: text("details"), // JSON object
  ipAddress: text("ip_address"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_admin_activity_logs_admin_id").on(table.adminId),
  index("idx_admin_activity_logs_created_at").on(table.createdAt),
]);

// Midtrans webhook logs table
export const midtransWebhookLogs = sqliteTable("midtrans_webhook_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull(),
  transactionId: text("transaction_id"),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(), // JSON
  signature: text("signature"),
  status: text("status", { enum: ["processed", "failed"] }).notNull(),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
});

// Usage tracking table
export const usageTracking = sqliteTable("usage_tracking", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id).notNull(),
  feature: text("feature").notNull(), // 'receiptOCR', 'aiChat', 'aiAnalysis'
  count: integer("count").notNull().default(0),
  period: text("period").notNull(), // 'YYYY-MM' format
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_usage_tracking_user_period").on(table.userId, table.period),
]);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  transactions: many(transactions),
  budgets: many(budgets),
  categories: many(categories),
  goals: many(goals),
  preferences: one(userPreferences),
  subscriptions: many(userSubscriptions),
  payments: many(payments),
  invoices: many(invoices),
  subscriptionPlan: one(subscriptionPlans, {
    fields: [users.subscriptionPlanId],
    references: [subscriptionPlans.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  budgets: many(budgets),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, {
    fields: [budgets.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
  boosts: many(goalBoosts),
  savingsPlans: many(goalSavingsPlans),
}));

export const goalBoostsRelations = relations(goalBoosts, ({ one }) => ({
  goal: one(goals, {
    fields: [goalBoosts.goalId],
    references: [goals.id],
  }),
  user: one(users, {
    fields: [goalBoosts.userId],
    references: [users.id],
  }),
}));

export const goalSavingsPlansRelations = relations(goalSavingsPlans, ({ one }) => ({
  goal: one(goals, {
    fields: [goalSavingsPlans.goalId],
    references: [goals.id],
  }),
  user: one(users, {
    fields: [goalSavingsPlans.userId],
    references: [users.id],
  }),
}));

// WhatsApp integrations relations
export const whatsappIntegrationsRelations = relations(whatsappIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [whatsappIntegrations.userId],
    references: [users.id],
  }),
}));

// WhatsApp activation codes relations
export const whatsappActivationCodesRelations = relations(whatsappActivationCodes, ({ one }) => ({
  user: one(users, {
    fields: [whatsappActivationCodes.userId],
    references: [users.id],
  }),
}));

// Notification logs relations
export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  user: one(users, {
    fields: [notificationLogs.userId],
    references: [users.id],
  }),
}));

// Admin Panel Relations

// Admin users relations
export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  activityLogs: many(adminActivityLogs),
  settingsUpdates: many(systemSettings),
}));

// Subscription plans relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(userSubscriptions),
  users: many(users),
}));

// User subscriptions relations
export const userSubscriptionsRelations = relations(userSubscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
  payments: many(payments),
}));

// Payments relations
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  subscription: one(userSubscriptions, {
    fields: [payments.subscriptionId],
    references: [userSubscriptions.id],
  }),
  invoices: many(invoices),
}));

// Invoices relations
export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  payment: one(payments, {
    fields: [invoices.paymentId],
    references: [payments.id],
  }),
}));

// System settings relations
export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updatedByAdmin: one(adminUsers, {
    fields: [systemSettings.updatedBy],
    references: [adminUsers.id],
  }),
}));

// Admin activity logs relations
export const adminActivityLogsRelations = relations(adminActivityLogs, ({ one }) => ({
  admin: one(adminUsers, {
    fields: [adminActivityLogs.adminId],
    references: [adminUsers.id],
  }),
}));

// Usage tracking relations
export const usageTrackingRelations = relations(usageTracking, ({ one }) => ({
  user: one(users, {
    fields: [usageTracking.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserPreferencesSchema = insertUserPreferencesSchema.omit({
  userId: true,
});

export const insertWhatsappIntegrationSchema = createInsertSchema(whatsappIntegrations).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappActivationCodeSchema = createInsertSchema(whatsappActivationCodes).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({
  id: true,
  createdAt: true,
});

// Admin Panel Insert Schemas
export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSubscriptionPlanSchema = insertSubscriptionPlanSchema.partial();

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
});

export const insertAdminActivityLogSchema = createInsertSchema(adminActivityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertMidtransWebhookLogSchema = createInsertSchema(midtransWebhookLogs).omit({
  id: true,
  createdAt: true,
});

export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type TransactionWithCategory = Transaction & { category: Category | null };
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;
export type BudgetWithCategory = Budget & { category: Category | null };
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UpdateUserPreferences = z.infer<typeof updateUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type WhatsappIntegration = typeof whatsappIntegrations.$inferSelect;
export type InsertWhatsappIntegration = z.infer<typeof insertWhatsappIntegrationSchema>;
export type WhatsappActivationCode = typeof whatsappActivationCodes.$inferSelect;
export type InsertWhatsappActivationCode = z.infer<typeof insertWhatsappActivationCodeSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;

// Admin Panel Types
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type UpdateSubscriptionPlan = z.infer<typeof updateSubscriptionPlanSchema>;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscriptionWithDetails = UserSubscription & {
  user: User;
  plan: SubscriptionPlan;
};

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type PaymentWithDetails = Payment & {
  user: User;
  subscription: UserSubscription | null;
};

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceWithDetails = Invoice & {
  user: User;
  payment: Payment | null;
};

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

export type AdminActivityLog = typeof adminActivityLogs.$inferSelect;
export type InsertAdminActivityLog = z.infer<typeof insertAdminActivityLogSchema>;

export type MidtransWebhookLog = typeof midtransWebhookLogs.$inferSelect;
export type InsertMidtransWebhookLog = z.infer<typeof insertMidtransWebhookLogSchema>;

export type UsageTracking = typeof usageTracking.$inferSelect;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
