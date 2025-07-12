import {
  users,
  categories,
  transactions,
  budgets,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Transaction,
  type TransactionWithCategory,
  type InsertTransaction,
  type Budget,
  type BudgetWithCategory,
  type InsertBudget,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Category operations
  getCategories(userId: string): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  initializeDefaultCategories(userId: string): Promise<void>;

  // Transaction operations
  getTransactions(userId: string, limit?: number): Promise<TransactionWithCategory[]>;
  getTransactionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TransactionWithCategory[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;
  getTransactionById(id: number): Promise<TransactionWithCategory | undefined>;

  // Budget operations
  getBudgets(userId: string): Promise<BudgetWithCategory[]>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget>;
  deleteBudget(id: number): Promise<void>;
  getBudgetById(id: number): Promise<BudgetWithCategory | undefined>;

  // Analytics operations
  getMonthlyExpenses(userId: string, months: number): Promise<any[]>;
  getCategoryExpenses(userId: string, startDate: Date, endDate: Date): Promise<any[]>;
  getTotalBalance(userId: string): Promise<number>;
  getMonthlyIncome(userId: string, year: number, month: number): Promise<number>;
  getMonthlyExpenseTotal(userId: string, year: number, month: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Category operations
  async getCategories(userId: string): Promise<Category[]> {
    return await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async initializeDefaultCategories(userId: string): Promise<void> {
    const defaultCategories = [
      { name: "Food & Dining", icon: "fas fa-utensils", color: "#059669", type: "expense" },
      { name: "Transportation", icon: "fas fa-car", color: "#3B82F6", type: "expense" },
      { name: "Shopping", icon: "fas fa-shopping-bag", color: "#F59E0B", type: "expense" },
      { name: "Entertainment", icon: "fas fa-film", color: "#EF4444", type: "expense" },
      { name: "Bills & Utilities", icon: "fas fa-file-invoice-dollar", color: "#8B5CF6", type: "expense" },
      { name: "Healthcare", icon: "fas fa-heart", color: "#EC4899", type: "expense" },
      { name: "Education", icon: "fas fa-graduation-cap", color: "#06B6D4", type: "expense" },
      { name: "Other", icon: "fas fa-ellipsis-h", color: "#6B7280", type: "expense" },
      { name: "Salary", icon: "fas fa-dollar-sign", color: "#10B981", type: "income" },
      { name: "Investment", icon: "fas fa-chart-line", color: "#059669", type: "income" },
      { name: "Freelance", icon: "fas fa-laptop", color: "#3B82F6", type: "income" },
    ];

    for (const category of defaultCategories) {
      await db.insert(categories).values({
        ...category,
        userId,
        isDefault: true,
      });
    }
  }

  // Transaction operations
  async getTransactions(userId: string, limit = 50): Promise<TransactionWithCategory[]> {
    const results = await db
      .select()
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date))
      .limit(limit);
      
    return results.map(row => ({
      ...row.transactions,
      category: row.categories
    }));
  }

  async getTransactionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TransactionWithCategory[]> {
    const results = await db
      .select()
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .orderBy(desc(transactions.date));
      
    return results.map(row => ({
      ...row.transactions,
      category: row.categories
    }));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction> {
    const [updatedTransaction] = await db
      .update(transactions)
      .set({ ...transaction, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return updatedTransaction;
  }

  async deleteTransaction(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async getTransactionById(id: number): Promise<TransactionWithCategory | undefined> {
    const [result] = await db
      .select()
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.transactions,
      category: result.categories
    };
  }

  // Budget operations
  async getBudgets(userId: string): Promise<BudgetWithCategory[]> {
    const results = await db
      .select()
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.userId, userId))
      .orderBy(desc(budgets.createdAt));
      
    return results.map(row => ({
      ...row.budgets,
      category: row.categories
    }));
  }

  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [newBudget] = await db
      .insert(budgets)
      .values(budget)
      .returning();
    return newBudget;
  }

  async updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget> {
    const [updatedBudget] = await db
      .update(budgets)
      .set({ ...budget, updatedAt: new Date() })
      .where(eq(budgets.id, id))
      .returning();
    return updatedBudget;
  }

  async deleteBudget(id: number): Promise<void> {
    await db.delete(budgets).where(eq(budgets.id, id));
  }

  async getBudgetById(id: number): Promise<BudgetWithCategory | undefined> {
    const [result] = await db
      .select()
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.budgets,
      category: result.categories
    };
  }

  // Analytics operations
  async getMonthlyExpenses(userId: string, months: number): Promise<any[]> {
    const result = await db
      .select({
        month: sql<string>`DATE_TRUNC('month', ${transactions.date})`,
        total: sum(transactions.amount),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          gte(transactions.date, sql`NOW() - INTERVAL '${months} months'`)
        )
      )
      .groupBy(sql`DATE_TRUNC('month', ${transactions.date})`)
      .orderBy(sql`DATE_TRUNC('month', ${transactions.date})`);
    
    return result;
  }

  async getCategoryExpenses(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const result = await db
      .select({
        categoryName: categories.name,
        categoryColor: categories.color,
        total: sum(transactions.amount),
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .groupBy(categories.name, categories.color)
      .orderBy(desc(sum(transactions.amount)));
    
    return result;
  }

  async getTotalBalance(userId: string): Promise<number> {
    const income = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "income")
        )
      );

    const expenses = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense")
        )
      );

    const totalIncome = parseFloat(income[0]?.total || "0");
    const totalExpenses = parseFloat(expenses[0]?.total || "0");
    
    return totalIncome - totalExpenses;
  }

  async getMonthlyIncome(userId: string, year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const result = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "income"),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    return parseFloat(result[0]?.total || "0");
  }

  async getMonthlyExpenseTotal(userId: string, year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const result = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    return parseFloat(result[0]?.total || "0");
  }
}

export const storage = new DatabaseStorage();
