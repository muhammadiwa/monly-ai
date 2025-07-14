import {
  users,
  userPreferences,
  categories,
  transactions,
  budgets,
  type User,
  type UpsertUser,
  type UserPreferences,
  type InsertUserPreferences,
  type UpdateUserPreferences,
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
  updateUser(id: string, userData: Partial<UpsertUser>): Promise<User>;
  
  // Demo authentication methods
  getUserByEmail(email: string): Promise<User | undefined>;
  createDemoUser(userData: { email: string; name: string; password: string }): Promise<User>;

  // User preferences operations
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: string, preferences: UpdateUserPreferences): Promise<UserPreferences>;

  // Category operations
  getCategories(userId: string): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  getCategoryById(id: number, userId: string): Promise<Category | undefined>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number, userId: string): Promise<void>;
  initializeDefaultCategories(userId: string): Promise<void>;

  // Transaction operations
  getTransactions(userId: string, limit?: number): Promise<TransactionWithCategory[]>;
  getTransactionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TransactionWithCategory[]>;
  getTransactionsByCategory(categoryId: number, userId: string): Promise<TransactionWithCategory[]>;
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

  // Get previous month data for comparison
  getPreviousMonthData(userId: string): Promise<{
    income: number;
    expenses: number;
    savingsRate: number;
  }>;

  // Get today's spending from database
  getTodaySpending(userId: string): Promise<number>;
  
  // Get weekly spending from database
  getWeeklySpending(userId: string): Promise<number>;

  // Calculate financial score based on user data
  calculateFinancialScore(userId: string): Promise<number>;

  // Live Cash Flow API methods
  getLiveCashFlow(userId: string): Promise<{
    currentBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    dailyIncome: number;
    dailyExpenses: number;
    dailyCashFlow: number;
    weeklyIncome: number;
    weeklyExpenses: number;
    weeklyCashFlow: number;
    monthlyCashFlow: number;
    projectedBalance: number;
    burnRate: number; // days until balance reaches zero
    cashFlowTrend: Array<{ date: string; amount: number }>;
  }>;

  // Comprehensive Dashboard Analytics - all calculations done in backend
  getDashboardAnalytics(userId: string): Promise<{
    // Financial Score & Summary
    financialScore: number;
    totalBalance: number;
    monthlyCashFlow: number;
    savingsRate: number;
    todaySpending: number;
    weeklySpending: number;
    weeklyBudgetUsed: number;
    
    // Monthly Data
    monthlyIncome: number;
    monthlyExpenseTotal: number;
    
    // Analytics Data
    monthlyExpenses: any[];
    categoryExpenses: any[];
    transactionCount: number;
    
    // Comparison Data
    previousMonth: {
      income: number;
      expenses: number;
      savingsRate: number;
    };
    changes: {
      incomeChange: string;
      expenseChange: string;
      savingsRateChange: string;
      investmentChange: string;
    };
    investmentGrowth: string;
  }>;

  // Intelligent Budgets API methods
  getIntelligentBudgets(userId: string): Promise<{
    suggestedBudgets: Array<{
      categoryId: number;
      categoryName: string;
      suggestedAmount: number;
      currentSpending: number;
      confidence: number; // 0-100%
      reasoning: string;
    }>;
    budgetOptimization: Array<{
      categoryId: number;
      categoryName: string;
      currentBudget: number;
      recommendedBudget: number;
      potentialSavings: number;
      priority: 'high' | 'medium' | 'low';
    }>;
    overallRecommendation: string;
  }>;

  // Helper methods for intelligent analysis
  getSpendingPatterns(userId: string, months: number): Promise<Array<{
    categoryId: number;
    categoryName: string;
    monthlyAverage: number;
    trend: string;
    volatility: number;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // Utility functions for handling mixed timestamp formats
  private normalizeTimestamp(timestamp: number): number {
    // If timestamp has more than 10 digits, it's in milliseconds, convert to seconds
    // Unix seconds: ~10 digits (e.g., 1751328000)
    // Unix milliseconds: ~13 digits (e.g., 1751328000000)
    if (timestamp > 9999999999) { // More than 10 digits
      return Math.floor(timestamp / 1000);
    }
    return timestamp;
  }

  private isDateInRange(timestamp: number, startSeconds: number, endSeconds: number): boolean {
    const normalizedTimestamp = this.normalizeTimestamp(timestamp);
    return normalizedTimestamp >= startSeconds && normalizedTimestamp <= endSeconds;
  }

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
          updatedAt: Math.floor(Date.now() / 1000), // Use Unix seconds
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: Math.floor(Date.now() / 1000), // Use Unix seconds
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createDemoUser(userData: { email: string; name: string; password: string }): Promise<User> {
    const userId = `demo_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).substring(2, 11)}`;
    const [user] = await db
      .insert(users)
      .values({
        id: userId,
        email: userData.email,
        firstName: userData.name.split(' ')[0] || userData.name,
        lastName: userData.name.split(' ').slice(1).join(' ') || null,
        password: userData.password,
        profileImageUrl: null,
      })
      .returning();
    return user;
  }

  // User preferences operations
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return preferences;
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const [newPreferences] = await db
      .insert(userPreferences)
      .values(preferences)
      .returning();
    return newPreferences;
  }

  async updateUserPreferences(userId: string, preferences: UpdateUserPreferences): Promise<UserPreferences> {
    const [updatedPreferences] = await db
      .update(userPreferences)
      .set(preferences)
      .where(eq(userPreferences.userId, userId))
      .returning();
    return updatedPreferences;
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

  async getCategoryById(id: number, userId: string): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
    return category;
  }

  async deleteCategory(id: number, userId: string): Promise<void> {
    await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  }

  async initializeDefaultCategories(userId: string): Promise<void> {
    const defaultCategories = [
      { name: "Food & Dining", icon: "🍽️", color: "#059669", type: "expense" },
      { name: "Transportation", icon: "🚗", color: "#3B82F6", type: "expense" },
      { name: "Shopping", icon: "🛒", color: "#F59E0B", type: "expense" },
      { name: "Entertainment", icon: "🎬", color: "#EF4444", type: "expense" },
      { name: "Bills & Utilities", icon: "🧾", color: "#8B5CF6", type: "expense" },
      { name: "Healthcare", icon: "🏥", color: "#EC4899", type: "expense" },
      { name: "Education", icon: "📚", color: "#06B6D4", type: "expense" },
      { name: "Other", icon: "📦", color: "#6B7280", type: "expense" },
      { name: "Salary", icon: "💰", color: "#10B981", type: "income" },
      { name: "Investment", icon: "📈", color: "#059669", type: "income" },
      { name: "Freelance", icon: "💻", color: "#3B82F6", type: "income" },
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
    const startTimestamp = startDate.getTime() / 1000; // Convert to Unix seconds
    const endTimestamp = endDate.getTime() / 1000; // Convert to Unix seconds

    // Get all user transactions and filter by date range
    const allTransactions = await db
      .select()
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    // Filter transactions within date range using normalized timestamps
    const filteredResults = allTransactions.filter(row => 
      this.isDateInRange(row.transactions.date, startTimestamp, endTimestamp)
    );
      
    return filteredResults.map(row => ({
      ...row.transactions,
      category: row.categories
    }));
  }

  async getTransactionsByCategory(categoryId: number, userId: string): Promise<TransactionWithCategory[]> {
    const results = await db
      .select()
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.categoryId, categoryId)
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
      .set({ ...transaction, updatedAt: Math.floor(Date.now() / 1000) }) // Use Unix seconds
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
      .set({ ...budget, updatedAt: Math.floor(Date.now() / 1000) }) // Use Unix seconds
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
    // Calculate timestamp for X months ago
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - months);
    const startTimestamp = monthsAgo.getTime();

    const result = await db
      .select({
        month: sql<string>`strftime('%Y-%m', datetime(date/1000, 'unixepoch'))`,
        total: sum(transactions.amount),
        count: sql<number>`COUNT(*)`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          gte(transactions.date, startTimestamp)
        )
      )
      .groupBy(sql`strftime('%Y-%m', datetime(date/1000, 'unixepoch'))`)
      .orderBy(sql`strftime('%Y-%m', datetime(date/1000, 'unixepoch'))`);
    
    return result;
  }

  async getCategoryExpenses(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const startTimestamp = startDate.getTime(); // Convert to timestamp
    const endTimestamp = endDate.getTime(); // Convert to timestamp
    
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
          gte(transactions.date, startTimestamp),
          lte(transactions.date, endTimestamp)
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
    const startDate = new Date(year, month, 1).getTime() / 1000; // Convert to Unix seconds
    const endDate = new Date(year, month + 1, 0).getTime() / 1000; // Convert to Unix seconds

    console.log(`getMonthlyIncome: ${year}-${month + 1}, range: ${startDate} to ${endDate}`);

    // Get all user income transactions and filter by date range
    const allTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "income")
        )
      );

    console.log(`Found ${allTransactions.length} income transactions for user ${userId}`);
    allTransactions.forEach(t => {
      const normalizedDate = this.normalizeTimestamp(t.date);
      const dateObj = new Date(normalizedDate * 1000);
      console.log(`Transaction ${t.id}: ${t.amount} IDR on ${dateObj.toLocaleDateString()} (raw: ${t.date}, normalized: ${normalizedDate})`);
    });

    // Filter transactions within date range using normalized timestamps
    const filteredTransactions = allTransactions.filter(transaction => 
      this.isDateInRange(transaction.date, startDate, endDate)
    );

    console.log(`Filtered to ${filteredTransactions.length} transactions in range`);

    // Calculate total income
    const total = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    
    console.log(`Total monthly income: ${total}`);
    return total;
  }

  async getMonthlyExpenseTotal(userId: string, year: number, month: number): Promise<number> {
    const startDate = new Date(year, month, 1).getTime() / 1000; // Convert to Unix seconds
    const endDate = new Date(year, month + 1, 0).getTime() / 1000; // Convert to Unix seconds

    console.log(`getMonthlyExpenseTotal: ${year}-${month + 1}, range: ${startDate} to ${endDate}`);

    // Get all user expense transactions and filter by date range
    const allTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense")
        )
      );

    console.log(`Found ${allTransactions.length} expense transactions for user ${userId}`);
    allTransactions.forEach(t => {
      const normalizedDate = this.normalizeTimestamp(t.date);
      const dateObj = new Date(normalizedDate * 1000);
      console.log(`Transaction ${t.id}: ${t.amount} IDR on ${dateObj.toLocaleDateString()} (raw: ${t.date}, normalized: ${normalizedDate})`);
    });

    // Filter transactions within date range using normalized timestamps
    const filteredTransactions = allTransactions.filter(transaction => 
      this.isDateInRange(transaction.date, startDate, endDate)
    );

    console.log(`Filtered to ${filteredTransactions.length} transactions in range`);

    // Calculate total expenses
    const total = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    
    console.log(`Total monthly expenses: ${total}`);
    return total;
  }

  // Get previous month data for comparison
  async getPreviousMonthData(userId: string): Promise<{
    income: number;
    expenses: number;
    savingsRate: number;
  }> {
    const now = new Date();
    const lastMonth = now.getMonth() - 1;
    const lastYear = lastMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const adjustedMonth = lastMonth < 0 ? 11 : lastMonth;

    const income = await this.getMonthlyIncome(userId, lastYear, adjustedMonth);
    const expenses = await this.getMonthlyExpenseTotal(userId, lastYear, adjustedMonth);
    const savingsRate = income > 0 ? ((income - expenses) / income * 100) : 0;

    return {
      income,
      expenses,
      savingsRate
    };
  }

  // Get today's spending from database
  async getTodaySpending(userId: string): Promise<number> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const endOfToday = (startOfToday * 1000 + (24 * 60 * 60 * 1000) - 1) / 1000;

    console.log(`getTodaySpending: range ${startOfToday} to ${endOfToday}`);

    // Get all user expense transactions and filter by today's date
    const allTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense")
        )
      );

    console.log(`Found ${allTransactions.length} expense transactions for user ${userId}`);

    // Filter transactions for today using normalized timestamps
    const todayTransactions = allTransactions.filter(transaction => 
      this.isDateInRange(transaction.date, startOfToday, endOfToday)
    );

    console.log(`Filtered to ${todayTransactions.length} transactions for today`);

    // Calculate total spending for today
    const total = todayTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    
    console.log(`Total today spending: ${total}`);
    return total;
  }

  // Get weekly spending from database  
  async getWeeklySpending(userId: string): Promise<number> {
    const now = new Date();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();

    const result = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          gte(transactions.date, startOfWeek)
        )
      );

    return parseFloat(result[0]?.total || "0");
  }

  // Calculate financial score based on real user data
  async calculateFinancialScore(userId: string): Promise<number> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Get current month data
    const monthlyIncome = await this.getMonthlyIncome(userId, currentYear, currentMonth);
    const monthlyExpenses = await this.getMonthlyExpenseTotal(userId, currentYear, currentMonth);
    const totalBalance = await this.getTotalBalance(userId);
    
    // Calculate key financial metrics
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome * 100) : 0;
    const cashFlow = monthlyIncome - monthlyExpenses;
    const expenseRatio = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome * 100) : 100;
    
    // Get recent transaction activity (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentTransactions = await this.getTransactionsByDateRange(userId, thirtyDaysAgo, now);
    const hasRecentActivity = recentTransactions.length > 0;
    
    // Calculate financial score (0-100)
    let score = 50; // Base score
    
    // Savings rate contribution (0-30 points)
    if (savingsRate >= 30) score += 30;
    else if (savingsRate >= 20) score += 25;
    else if (savingsRate >= 15) score += 20;
    else if (savingsRate >= 10) score += 15;
    else if (savingsRate >= 5) score += 10;
    else if (savingsRate >= 0) score += 5;
    else score -= 10; // Negative savings rate
    
    // Cash flow contribution (0-25 points)
    if (cashFlow > monthlyIncome * 0.2) score += 25; // Saving >20% of income
    else if (cashFlow > monthlyIncome * 0.1) score += 20; // Saving >10% of income
    else if (cashFlow > 0) score += 15; // Positive cash flow
    else if (cashFlow > -monthlyIncome * 0.1) score += 5; // Small deficit
    else score -= 15; // Large deficit
    
    // Net worth contribution (0-20 points)
    if (totalBalance > monthlyExpenses * 6) score += 20; // 6 months emergency fund
    else if (totalBalance > monthlyExpenses * 3) score += 15; // 3 months emergency fund
    else if (totalBalance > monthlyExpenses) score += 10; // 1 month emergency fund
    else if (totalBalance > 0) score += 5; // Positive net worth
    else score -= 10; // Negative net worth
    
    // Income stability (0-15 points)
    if (monthlyIncome > 0) {
      score += 10; // Has income
      if (monthlyIncome > monthlyExpenses * 2) score += 5; // High income relative to expenses
    }
    
    // Activity bonus (0-10 points)
    if (hasRecentActivity) score += 10;
    
    // Expense management (0-10 points)
    if (expenseRatio <= 50) score += 10; // Very low expenses
    else if (expenseRatio <= 70) score += 7; // Low expenses
    else if (expenseRatio <= 90) score += 5; // Moderate expenses
    else if (expenseRatio <= 100) score += 2; // Breaking even
    // No penalty for high expenses as it's already reflected in savings rate
    
    // Ensure score is within bounds
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Comprehensive Dashboard Analytics - all calculations done in backend
  async getDashboardAnalytics(userId: string): Promise<{
    financialScore: number;
    totalBalance: number;
    monthlyCashFlow: number;
    savingsRate: number;
    todaySpending: number;
    weeklySpending: number;
    weeklyBudgetUsed: number;
    monthlyIncome: number;
    monthlyExpenseTotal: number;
    monthlyExpenses: any[];
    categoryExpenses: any[];
    transactionCount: number;
    previousMonth: {
      income: number;
      expenses: number;
      savingsRate: number;
    };
    changes: {
      incomeChange: string;
      expenseChange: string;
      savingsRateChange: string;
      investmentChange: string;
    };
    investmentGrowth: string;
  }> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    console.log(`Dashboard Analytics: Calculating for ${currentYear}-${currentMonth + 1}`);

    // Get all financial data
    const [
      financialScore,
      totalBalance,
      monthlyIncome,
      monthlyExpenseTotal,
      todaySpending,
      weeklySpending,
      monthlyExpenses,
      previousMonthData
    ] = await Promise.all([
      this.calculateFinancialScore(userId),
      this.getTotalBalance(userId),
      this.getMonthlyIncome(userId, currentYear, currentMonth),
      this.getMonthlyExpenseTotal(userId, currentYear, currentMonth),
      this.getTodaySpending(userId),
      this.getWeeklySpending(userId),
      this.getMonthlyExpenses(userId, 6),
      this.getPreviousMonthData(userId)
    ]);

    // Get current month category breakdown
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const categoryExpenses = await this.getCategoryExpenses(userId, startOfMonth, endOfMonth);

    // Calculate monthly cash flow and savings rate
    const monthlyCashFlow = monthlyIncome - monthlyExpenseTotal;
    const currentSavingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenseTotal) / monthlyIncome * 100) : 0;

    // Get budgets for weekly calculation
    const budgets = await this.getBudgets(userId);
    const weeklyBudgetLimit = budgets.reduce((sum, budget) => sum + (budget.amount / 4), 0);
    const weeklyBudgetUsed = weeklyBudgetLimit > 0 ? Math.round((weeklySpending / weeklyBudgetLimit) * 100) : 0;

    // Calculate percentage changes
    const incomeChange = previousMonthData.income > 0 ? 
      ((monthlyIncome - previousMonthData.income) / previousMonthData.income * 100) : 0;
    const expenseChange = previousMonthData.expenses > 0 ? 
      ((monthlyExpenseTotal - previousMonthData.expenses) / previousMonthData.expenses * 100) : 0;
    const savingsRateChange = currentSavingsRate - previousMonthData.savingsRate;
    
    // Calculate investment growth (simplified calculation based on savings)
    const investmentGrowth = currentSavingsRate > 15 ? 8.5 : currentSavingsRate > 10 ? 5.2 : 2.1;
    const investmentChange = previousMonthData.savingsRate > 0 ? 
      ((currentSavingsRate - previousMonthData.savingsRate) / previousMonthData.savingsRate * 100) : 0;

    // Calculate transaction count
    const transactionCount = monthlyExpenses.reduce((sum, month) => sum + (month.count || 0), 0);

    console.log('Dashboard Analytics Results:', {
      monthlyIncome,
      monthlyExpenseTotal,
      monthlyCashFlow,
      currentSavingsRate: currentSavingsRate.toFixed(1),
      todaySpending,
      weeklySpending,
      financialScore
    });

    return {
      financialScore,
      totalBalance,
      monthlyCashFlow,
      savingsRate: parseFloat(currentSavingsRate.toFixed(1)),
      todaySpending,
      weeklySpending,
      weeklyBudgetUsed,
      monthlyIncome,
      monthlyExpenseTotal,
      monthlyExpenses,
      categoryExpenses,
      transactionCount,
      previousMonth: previousMonthData,
      changes: {
        incomeChange: incomeChange.toFixed(1),
        expenseChange: expenseChange.toFixed(1),
        savingsRateChange: savingsRateChange.toFixed(1),
        investmentChange: investmentChange.toFixed(1)
      },
      investmentGrowth: investmentGrowth.toFixed(1)
    };
  }

  // Intelligent Budgets implementation
  async getIntelligentBudgets(userId: string): Promise<{
    suggestedBudgets: Array<{
      categoryId: number;
      categoryName: string;
      suggestedAmount: number;
      currentSpending: number;
      confidence: number;
      reasoning: string;
    }>;
    budgetOptimization: Array<{
      categoryId: number;
      categoryName: string;
      currentBudget: number;
      recommendedBudget: number;
      potentialSavings: number;
      priority: 'high' | 'medium' | 'low';
    }>;
    overallRecommendation: string;
  }> {
    const now = new Date();
    const spendingPatterns = await this.getSpendingPatterns(userId, 6); // Last 6 months
    const currentBudgets = await this.getBudgets(userId);
    const monthlyIncome = await this.getMonthlyIncome(userId, now.getFullYear(), now.getMonth());

    // Generate suggested budgets for categories without budgets
    const existingBudgetCategories = new Set(currentBudgets.map(b => b.categoryId));
    const suggestedBudgets = spendingPatterns
      .filter(pattern => !existingBudgetCategories.has(pattern.categoryId))
      .map(pattern => {
        // Calculate suggested amount based on average spending + 10% buffer
        const suggestedAmount = Math.round(pattern.monthlyAverage * 1.1);
        
        // Calculate confidence based on spending consistency
        const confidence = Math.max(60, Math.min(95, 100 - (pattern.volatility * 100)));
        
        let reasoning = '';
        if (pattern.trend === 'increasing') {
          reasoning = `Based on your increasing spending trend in this category (${pattern.monthlyAverage.toFixed(0)} average), we suggest a budget with 10% buffer.`;
        } else if (pattern.trend === 'decreasing') {
          reasoning = `Your spending in this category is decreasing. This budget allows for some flexibility while encouraging continued reduction.`;
        } else {
          reasoning = `Based on your consistent spending pattern (${pattern.monthlyAverage.toFixed(0)} average), this budget provides a small buffer for unexpected expenses.`;
        }

        return {
          categoryId: pattern.categoryId,
          categoryName: pattern.categoryName,
          suggestedAmount,
          currentSpending: pattern.monthlyAverage,
          confidence,
          reasoning
        };
      });

    // Generate budget optimization recommendations
    const budgetOptimization = currentBudgets.map(budget => {
      const pattern = spendingPatterns.find(p => p.categoryId === budget.categoryId);
      if (!pattern) {
        return {
          categoryId: budget.categoryId,
          categoryName: budget.category?.name || 'Unknown',
          currentBudget: budget.amount,
          recommendedBudget: budget.amount,
          potentialSavings: 0,
          priority: 'low' as const
        };
      }

      // Calculate recommended budget based on actual spending patterns
      let recommendedBudget = Math.round(pattern.monthlyAverage * 1.05); // 5% buffer
      
      // Adjust based on trend
      if (pattern.trend === 'increasing') {
        recommendedBudget = Math.round(pattern.monthlyAverage * 1.15); // 15% buffer for increasing trend
      } else if (pattern.trend === 'decreasing') {
        recommendedBudget = Math.round(pattern.monthlyAverage * 0.95); // Encourage further reduction
      }

      const potentialSavings = Math.max(0, budget.amount - recommendedBudget);
      
      // Determine priority based on potential savings and budget size
      let priority: 'high' | 'medium' | 'low' = 'low';
      const savingsPercentage = budget.amount > 0 ? (potentialSavings / budget.amount) * 100 : 0;
      
      if (potentialSavings > 100 && savingsPercentage > 20) priority = 'high';
      else if (potentialSavings > 50 && savingsPercentage > 10) priority = 'medium';

      return {
        categoryId: budget.categoryId,
        categoryName: budget.category?.name || 'Unknown',
        currentBudget: budget.amount,
        recommendedBudget,
        potentialSavings,
        priority
      };
    });

    // Generate overall recommendation
    const totalPotentialSavings = budgetOptimization.reduce((sum, opt) => sum + opt.potentialSavings, 0);
    const highPriorityOptimizations = budgetOptimization.filter(opt => opt.priority === 'high').length;
    
    let overallRecommendation = '';
    if (totalPotentialSavings > 500) {
      overallRecommendation = `You could potentially save $${totalPotentialSavings.toFixed(0)} per month by optimizing your budgets. Focus on the ${highPriorityOptimizations} high-priority categories first.`;
    } else if (totalPotentialSavings > 100) {
      overallRecommendation = `There's potential to save $${totalPotentialSavings.toFixed(0)} per month through budget optimization. Consider adjusting your high-priority budgets.`;
    } else {
      overallRecommendation = `Your budgets are well-aligned with your spending patterns. Consider setting budgets for categories where you don't have them yet.`;
    }

    return {
      suggestedBudgets,
      budgetOptimization,
      overallRecommendation
    };
  }

  // Live Cash Flow implementation
  async getLiveCashFlow(userId: string): Promise<{
    currentBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    dailyIncome: number;
    dailyExpenses: number;
    dailyCashFlow: number;
    weeklyIncome: number;
    weeklyExpenses: number;
    weeklyCashFlow: number;
    monthlyCashFlow: number;
    projectedBalance: number;
    burnRate: number;
    cashFlowTrend: Array<{ date: string; amount: number }>;
  }> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    console.log(`Live Cash Flow: Calculating for ${currentYear}-${currentMonth + 1}`);

    // Get basic financial data
    const [currentBalance, monthlyIncome, monthlyExpenses] = await Promise.all([
      this.getTotalBalance(userId),
      this.getMonthlyIncome(userId, currentYear, currentMonth),
      this.getMonthlyExpenseTotal(userId, currentYear, currentMonth)
    ]);
    
    const monthlyCashFlow = monthlyIncome - monthlyExpenses;

    // Calculate daily and weekly cash flow (last 30 days average)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000); // Convert to Unix seconds
    const nowTimestamp = Math.floor(now.getTime() / 1000); // Convert to Unix seconds
    
    // Use precise start/end dates with Unix seconds
    const last30DaysTransactions = await this.getTransactionsByDateRange(
      userId,
      new Date(thirtyDaysAgoTimestamp * 1000),
      new Date(nowTimestamp * 1000)
    );
    
    // Calculate daily averages
    const dailyIncomeTotal = last30DaysTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0) / 30;
    
    const dailyExpenseTotal = last30DaysTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0) / 30;
    
    const dailyCashFlow = dailyIncomeTotal - dailyExpenseTotal;

    // Calculate weekly averages (correctly based on daily amounts)
    const weeklyIncomeTotal = dailyIncomeTotal * 7;
    const weeklyExpenseTotal = dailyExpenseTotal * 7;
    const weeklyCashFlow = weeklyIncomeTotal - weeklyExpenseTotal;

    // Calculate projected balance (3 months ahead)
    const projectedBalance = currentBalance + (monthlyCashFlow * 3);

    // Calculate burn rate (days until balance reaches zero)
    let burnRate = -1; // -1 means indefinite (positive cash flow)
    if (dailyCashFlow < 0 && currentBalance > 0) {
      burnRate = Math.floor(currentBalance / Math.abs(dailyCashFlow));
    }

    // Generate cash flow trend (last 35 days, grouped by week with improved label accuracy)
    const cashFlowTrend: Array<{ date: string; amount: number; weekStart: string; weekEnd: string }> = [];
    
    for (let i = 4; i >= 0; i--) {
      // Calculate week boundaries in a more calendar-accurate way
      // Start from the beginning of current day and go back in weekly increments
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Get start and end of the week (going back i+1 weeks for start, i weeks for end)
      const weekStartTime = new Date(todayStart.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEndTime = new Date(todayStart.getTime() - i * 7 * 24 * 60 * 60 * 1000 - 1); // -1ms to not include next week
      
      // Convert to Unix seconds for consistent date handling
      const weekStartTimestamp = Math.floor(weekStartTime.getTime() / 1000);
      const weekEndTimestamp = Math.floor(weekEndTime.getTime() / 1000);
      
      // Format dates for display
      const weekStartFormatted = weekStartTime.toISOString().split('T')[0];
      const weekEndFormatted = weekEndTime.toISOString().split('T')[0];
      
      // Log for debugging
      console.log(`Week ${5-i}: ${weekStartFormatted} to ${weekEndFormatted} [${weekStartTimestamp}-${weekEndTimestamp}]`);
      
      // Get transactions for this week using precise timestamp ranges
      const weekTransactions = await this.getTransactionsByDateRange(
        userId, 
        weekStartTime,
        weekEndTime
      );
      
      // Calculate net cash flow for the week
      const weekIncome = weekTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const weekExpense = weekTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const weekNetFlow = weekIncome - weekExpense;
      
      // Use a more descriptive label format for the week
      const weekLabel = `${weekStartFormatted}`;
      
      // Log transactions for debugging
      console.log(`Week ${5-i} transactions: ${weekTransactions.length}`);
      weekTransactions.forEach(t => {
        const date = new Date(this.normalizeTimestamp(t.date) * 1000);
        console.log(`  - ${t.type}: ${t.amount} (${date.toISOString().split('T')[0]})`);
      });
      
      // Add to trend data with better labeling
      cashFlowTrend.push({
        date: weekLabel,
        weekStart: weekStartFormatted,
        weekEnd: weekEndFormatted,
        amount: weekNetFlow
      });
      
      console.log(`Week ${5-i} flow: income=${weekIncome}, expense=${weekExpense}, net=${weekNetFlow}`);
    }

    console.log('Live Cash Flow Results:', {
      currentBalance,
      monthlyIncome,
      monthlyExpenses,
      monthlyCashFlow,
      dailyIncome: dailyIncomeTotal,
      dailyExpenses: dailyExpenseTotal,
      dailyCashFlow,
      burnRate
    });

    return {
      currentBalance,
      monthlyIncome,
      monthlyExpenses,
      dailyIncome: dailyIncomeTotal,
      dailyExpenses: dailyExpenseTotal,
      dailyCashFlow,
      weeklyIncome: weeklyIncomeTotal,
      weeklyExpenses: weeklyExpenseTotal,
      weeklyCashFlow,
      monthlyCashFlow,
      projectedBalance,
      burnRate,
      cashFlowTrend
    };
  }

  // Helper method to get spending patterns
  async getSpendingPatterns(userId: string, months: number): Promise<Array<{
    categoryId: number;
    categoryName: string;
    monthlyAverage: number;
    trend: string;
    volatility: number;
  }>> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    // Get all transactions for the period
    const transactions = await this.getTransactionsByDateRange(userId, startDate, now);
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    // Group by category and month
    const categoryMonthlySpending: Record<number, Record<string, number>> = {};
    
    expenseTransactions.forEach(transaction => {
      if (!transaction.categoryId) return;
      
      // Use normalized timestamp for consistent date handling
      const normalizedTimestamp = this.normalizeTimestamp(transaction.date);
      const transactionDate = new Date(normalizedTimestamp * 1000);
      const monthKey = `${transactionDate.getFullYear()}-${transactionDate.getMonth()}`;
      
      if (!categoryMonthlySpending[transaction.categoryId]) {
        categoryMonthlySpending[transaction.categoryId] = {};
      }
      
      if (!categoryMonthlySpending[transaction.categoryId][monthKey]) {
        categoryMonthlySpending[transaction.categoryId][monthKey] = 0;
      }
      
      categoryMonthlySpending[transaction.categoryId][monthKey] += transaction.amount;
    });

    // Calculate patterns for each category
    const patterns = Object.entries(categoryMonthlySpending).map(([categoryIdStr, monthlyData]) => {
      const categoryId = parseInt(categoryIdStr);
      const amounts = Object.values(monthlyData);
      const monthlyAverage = amounts.reduce((sum, amount) => sum + amount, 0) / Math.max(amounts.length, 1);
      
      // Calculate trend (compare first half vs second half)
      const halfLength = Math.floor(amounts.length / 2);
      const firstHalf = amounts.slice(0, halfLength);
      const secondHalf = amounts.slice(-halfLength);
      
      const firstHalfAvg = firstHalf.reduce((sum, amount) => sum + amount, 0) / Math.max(firstHalf.length, 1);
      const secondHalfAvg = secondHalf.reduce((sum, amount) => sum + amount, 0) / Math.max(secondHalf.length, 1);
      
      let trend = 'stable';
      if (firstHalfAvg > 0) {
        const changePercentage = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
        if (changePercentage > 0.15) trend = 'increasing';
        else if (changePercentage < -0.15) trend = 'decreasing';
      }
      
      // Calculate volatility (coefficient of variation)
      const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - monthlyAverage, 2), 0) / Math.max(amounts.length, 1);
      const standardDeviation = Math.sqrt(variance);
      const volatility = monthlyAverage > 0 ? standardDeviation / monthlyAverage : 0;
      
      // Get category name
      const categoryName = expenseTransactions.find(t => t.categoryId === categoryId)?.category?.name || 'Unknown';
      
      return {
        categoryId,
        categoryName,
        monthlyAverage,
        trend,
        volatility
      };
    });

    return patterns.filter(pattern => pattern.monthlyAverage > 0);
  }
}

export const storage = new DatabaseStorage();
