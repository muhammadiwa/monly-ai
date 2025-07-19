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
  createdAt: integer("created_at"), // Unix timestamp
  updatedAt: integer("updated_at"), // Unix timestamp
});

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

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  transactions: many(transactions),
  budgets: many(budgets),
  categories: many(categories),
  goals: many(goals),
  preferences: one(userPreferences),
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
