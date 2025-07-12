import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeTransactionText, processReceiptImage, categorizeTransaction } from "./openai";
import { insertTransactionSchema, insertBudgetSchema, insertCategorySchema } from "@shared/schema";
import { requireAuth, optionalAuth, hashPassword, verifyPassword, generateToken, type AuthRequest } from "./auth";
import multer from "multer";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";

const upload = multer({ storage: multer.memoryStorage() });
const MemStore = MemoryStore(session);

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(session({
    store: new MemStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    }
  }));

  // Auth routes
  app.post('/api/auth/register', async (req: AuthRequest, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Split name into firstName and lastName
      const nameParts = validatedData.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Create user
      const user = await storage.createDemoUser({
        email: validatedData.email,
        name: validatedData.name,
        password: hashedPassword,
      });

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email || '',
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email || '',
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input data', errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req: AuthRequest, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      // Find user by email
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Verify password
      const isValidPassword = await verifyPassword(validatedData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email || '',
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      });

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email || '',
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input data', errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/auth/user', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if user has categories, if not create defaults
      const categories = await storage.getCategories(req.user.id);
      if (categories.length === 0) {
        await storage.initializeDefaultCategories(req.user.id);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Categories routes
  app.get('/api/categories', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const categories = await storage.getCategories(req.user.id);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const categoryData = insertCategorySchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Transaction routes
  app.get('/api/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await storage.getTransactions(req.user.id, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post('/api/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        userId: req.user.id,
        date: Math.floor((new Date(req.body.date || Date.now())).getTime() / 1000), // Convert to Unix timestamp
      });
      
      const transaction = await storage.createTransaction(transactionData);
      res.json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  app.put('/api/transactions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const id = parseInt(req.params.id);
      const updateData = {
        ...req.body,
        date: req.body.date ? Math.floor((new Date(req.body.date)).getTime() / 1000) : undefined,
      };
      
      const transaction = await storage.updateTransaction(id, updateData);
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  app.delete('/api/transactions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const id = parseInt(req.params.id);
      await storage.deleteTransaction(id);
      res.json({ message: "Transaction deleted successfully" });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // AI-powered transaction analysis
  app.post('/api/transactions/analyze', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }
      
      const analysis = await analyzeTransactionText(text);
      
      // Find matching category
      const categories = await storage.getCategories(req.user.id);
      const matchingCategory = categories.find(c => 
        c.name.toLowerCase() === analysis.category.toLowerCase()
      );
      
      if (matchingCategory) {
        const transactionData = insertTransactionSchema.parse({
          userId: req.user.id,
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
  app.post('/api/transactions/ocr', requireAuth, upload.single('receipt'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      if (!req.file) {
        return res.status(400).json({ message: "Receipt image is required" });
      }
      
      const base64Image = req.file.buffer.toString('base64');
      const ocrResult = await processReceiptImage(base64Image);
      
      const createdTransactions = [];
      const categories = await storage.getCategories(req.user.id);
      
      for (const analysis of ocrResult.transactions) {
        const matchingCategory = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        if (matchingCategory) {
          const transactionData = insertTransactionSchema.parse({
            userId: req.user.id,
            categoryId: matchingCategory.id,
            amount: analysis.amount.toString(),
            currency: "USD",
            description: analysis.description,
            type: analysis.type,
            date: Math.floor(Date.now() / 1000), // Convert to Unix timestamp
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
  app.get('/api/budgets', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const budgets = await storage.getBudgets(req.user.id);
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post('/api/budgets', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const budgetData = insertBudgetSchema.parse({
        ...req.body,
        userId: req.user.id,
        startDate: Math.floor((new Date(req.body.startDate)).getTime() / 1000),
        endDate: Math.floor((new Date(req.body.endDate)).getTime() / 1000),
      });
      
      const budget = await storage.createBudget(budgetData);
      res.json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.put('/api/budgets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
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

  app.delete('/api/budgets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
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
  app.get('/api/analytics/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const now = new Date();
      
      // Get current month stats
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Get last 6 months expenses
      const monthlyExpenses = await storage.getMonthlyExpenses(req.user.id, 6);
      
      // Get current month category breakdown
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
      const categoryExpenses = await storage.getCategoryExpenses(req.user.id, startOfMonth, endOfMonth);
      
      // Get totals
      const totalBalance = await storage.getTotalBalance(req.user.id);
      const monthlyIncome = await storage.getMonthlyIncome(req.user.id, currentYear, currentMonth);
      const monthlyExpenseTotal = await storage.getMonthlyExpenseTotal(req.user.id, currentYear, currentMonth);
      
      const dashboardData = {
        monthlyExpenses,
        categoryExpenses,
        totalBalance,
        monthlyIncome,
        monthlyExpenseTotal,
        savingsRate: monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenseTotal) / monthlyIncome * 100).toFixed(1) : 0,
        transactionCount: monthlyExpenses.reduce((sum, month) => sum + (month.count || 0), 0),
      };
      
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard analytics" });
    }
  });

  // WhatsApp chat route
  app.post('/api/whatsapp/chat', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { message } = req.body;
      
      // Analyze the message for transaction data
      const analysis = await analyzeTransactionText(message);
      
      if (analysis.amount > 0) {
        // Try to find matching category
        const categories = await storage.getCategories(req.user.id);
        const matchingCategory = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        if (matchingCategory) {
          // Create transaction
          const transactionData = insertTransactionSchema.parse({
            userId: req.user.id,
            categoryId: matchingCategory.id,
            amount: analysis.amount.toString(),
            currency: "USD",
            description: analysis.description,
            type: analysis.type,
            date: Math.floor(Date.now() / 1000), // Convert to Unix timestamp
            aiGenerated: true,
          });
          
          const transaction = await storage.createTransaction(transactionData);
          
          res.json({
            message: `Transaction recorded: ${analysis.description} - $${analysis.amount} in ${analysis.category}`,
            transaction,
            analysis
          });
        } else {
          res.json({
            message: `I found a ${analysis.type} of $${analysis.amount} for ${analysis.description}, but couldn't find a matching category. Please create the category first.`,
            analysis
          });
        }
      } else {
        res.json({
          message: "I couldn't identify any transaction details in your message. Could you please be more specific about the amount and what you spent money on?",
          analysis
        });
      }
    } catch (error) {
      console.error("Error processing WhatsApp message:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Additional analytics routes
  app.get('/api/analytics/monthly/:year/:month', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const [income, expenses, categoryExpenses] = await Promise.all([
        storage.getMonthlyIncome(req.user.id, year, month),
        storage.getMonthlyExpenseTotal(req.user.id, year, month),
        storage.getCategoryExpenses(req.user.id, 
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
