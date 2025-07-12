import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { analyzeTransactionText, processReceiptImage, categorizeTransaction } from "./openai";
import { insertTransactionSchema, insertBudgetSchema, insertCategorySchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user has categories, if not create defaults
      const categories = await storage.getCategories(userId);
      if (categories.length === 0) {
        await storage.initializeDefaultCategories(userId);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Category routes
  app.get('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categories = await storage.getCategories(userId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categoryData = insertCategorySchema.parse({
        ...req.body,
        userId,
      });
      
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Transaction routes
  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await storage.getTransactions(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        userId,
        date: new Date(req.body.date || Date.now()),
      });
      
      const transaction = await storage.createTransaction(transactionData);
      res.json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  app.put('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : undefined,
      };
      
      const transaction = await storage.updateTransaction(id, updateData);
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  app.delete('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTransaction(id);
      res.json({ message: "Transaction deleted successfully" });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // AI-powered transaction analysis
  app.post('/api/transactions/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const { text } = req.body;
      const userId = req.user.claims.sub;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }
      
      const analysis = await analyzeTransactionText(text);
      
      // Find matching category
      const categories = await storage.getCategories(userId);
      const matchingCategory = categories.find(c => 
        c.name.toLowerCase() === analysis.category.toLowerCase()
      );
      
      if (matchingCategory) {
        const transactionData = insertTransactionSchema.parse({
          userId,
          categoryId: matchingCategory.id,
          amount: analysis.amount.toString(),
          currency: "USD",
          description: analysis.description,
          type: analysis.type,
          date: new Date(),
          aiGenerated: true,
        });
        
        const transaction = await storage.createTransaction(transactionData);
        res.json({ transaction, analysis });
      } else {
        res.json({ analysis, message: "Category not found, transaction not created" });
      }
    } catch (error) {
      console.error("Error analyzing transaction:", error);
      res.status(500).json({ message: "Failed to analyze transaction" });
    }
  });

  // OCR receipt processing
  app.post('/api/transactions/ocr', isAuthenticated, upload.single('receipt'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!req.file) {
        return res.status(400).json({ message: "Receipt image is required" });
      }
      
      const base64Image = req.file.buffer.toString('base64');
      const ocrResult = await processReceiptImage(base64Image);
      
      const createdTransactions = [];
      const categories = await storage.getCategories(userId);
      
      for (const analysis of ocrResult.transactions) {
        const matchingCategory = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        if (matchingCategory) {
          const transactionData = insertTransactionSchema.parse({
            userId,
            categoryId: matchingCategory.id,
            amount: analysis.amount.toString(),
            currency: "USD",
            description: analysis.description,
            type: analysis.type,
            date: new Date(),
            aiGenerated: true,
          });
          
          const transaction = await storage.createTransaction(transactionData);
          createdTransactions.push(transaction);
        }
      }
      
      res.json({ 
        ocrResult, 
        createdTransactions,
        message: `Created ${createdTransactions.length} transactions from receipt`
      });
    } catch (error) {
      console.error("Error processing receipt:", error);
      res.status(500).json({ message: "Failed to process receipt" });
    }
  });

  // Budget routes
  app.get('/api/budgets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const budgets = await storage.getBudgets(userId);
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post('/api/budgets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const budgetData = insertBudgetSchema.parse({
        ...req.body,
        userId,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      });
      
      const budget = await storage.createBudget(budgetData);
      res.json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.put('/api/budgets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };
      
      const budget = await storage.updateBudget(id, updateData);
      res.json(budget);
    } catch (error) {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  app.delete('/api/budgets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBudget(id);
      res.json({ message: "Budget deleted successfully" });
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // Analytics routes
  app.get('/api/analytics/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      const [
        totalBalance,
        monthlyIncome,
        monthlyExpenses,
        monthlyExpensesData,
        categoryExpenses,
        recentTransactions
      ] = await Promise.all([
        storage.getTotalBalance(userId),
        storage.getMonthlyIncome(userId, currentYear, currentMonth),
        storage.getMonthlyExpenseTotal(userId, currentYear, currentMonth),
        storage.getMonthlyExpenses(userId, 6),
        storage.getCategoryExpenses(userId, 
          new Date(currentYear, currentMonth - 1, 1), 
          new Date(currentYear, currentMonth, 0)
        ),
        storage.getTransactions(userId, 10)
      ]);
      
      res.json({
        totalBalance,
        monthlyIncome,
        monthlyExpenses,
        monthlyExpensesData,
        categoryExpenses,
        recentTransactions,
        savingsGoal: {
          target: 2000,
          current: Math.max(0, monthlyIncome - monthlyExpenses),
          percentage: Math.min(100, Math.max(0, ((monthlyIncome - monthlyExpenses) / 2000) * 100))
        }
      });
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard analytics" });
    }
  });

  app.get('/api/analytics/monthly/:year/:month', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const [income, expenses, categoryExpenses] = await Promise.all([
        storage.getMonthlyIncome(userId, year, month),
        storage.getMonthlyExpenseTotal(userId, year, month),
        storage.getCategoryExpenses(userId, 
          new Date(year, month - 1, 1), 
          new Date(year, month, 0)
        )
      ]);
      
      res.json({
        income,
        expenses,
        categoryExpenses,
        net: income - expenses
      });
    } catch (error) {
      console.error("Error fetching monthly analytics:", error);
      res.status(500).json({ message: "Failed to fetch monthly analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
