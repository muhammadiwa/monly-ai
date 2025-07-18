import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeTransactionText, processReceiptImage } from "./openai";
import { insertTransactionSchema, insertBudgetSchema, insertCategorySchema, insertGoalSchema, updateUserPreferencesSchema } from "@shared/schema";
import { requireAuth, hashPassword, verifyPassword, generateToken, type AuthRequest } from "./auth";
import { AIFinancialIntelligenceEngine } from './ai-intelligence';
import whatsappRoutes from './whatsapp-routes';
import whatsappMultiAccountRoutes from './whatsapp-multi-account-routes';
import multer from "multer";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import OpenAI from "openai";

// Helper function to get currency symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'IDR': 'Rp',
    'CNY': '¥',
    'KRW': '₩',
    'SGD': 'S$',
    'MYR': 'RM',
    'THB': '฿',
    'VND': '₫'
  };
  return symbols[currency] || currency;
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "default_key"
});

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
  // Register WhatsApp routes
  app.use('/api', whatsappRoutes);
  app.use('/api', whatsappMultiAccountRoutes);
  
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
      if (!user?.password) {
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

      // Check if user has preferences, if not create defaults
      let preferences = await storage.getUserPreferences(req.user.id);
      if (!preferences) {
        preferences = await storage.initializeDefaultUserPreferences(req.user.id);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile update
  app.put('/api/user/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const { firstName, lastName, email } = req.body;
      
      console.log('Update profile request:', { firstName, lastName, email, userId: req.user.id });
      
      // Validate input
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "First name, last name, and email are required" });
      }
      
      // Check if email is already taken by another user
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: "Email already taken" });
      }
      
      // Update user profile with explicit field mapping
      const updateData = {
        firstName: firstName.toString(),
        lastName: lastName.toString(),
        email: email.toString()
      };
      
      console.log('Updating user with data:', updateData);
      
      const updatedUser = await storage.updateUser(req.user.id, updateData);
      
      console.log('Profile updated successfully:', updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // User profile image upload
  app.post('/api/user/upload-profile-image', requireAuth, upload.single('profileImage'), async (req: AuthRequest, res) => {
    try {
      console.log("Profile image upload request received");
      
      if (!req.user) {
        console.log("Unauthorized - No user in request");
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      if (!req.file) {
        console.log("No file in request");
        return res.status(400).json({ message: "Profile image is required" });
      }
      
      console.log("File received:", {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
      
      // Validate file type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "File must be an image" });
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: "Image size must be less than 5MB" });
      }
      
      // Convert the image to Base64 for storage
      // In a production app, you should use a proper file storage service like AWS S3
      const base64Image = req.file.buffer.toString('base64');
      
      // Create a data URL for the image
      const mimeType = req.file.mimetype;
      const dataUrl = `data:${mimeType};base64,${base64Image}`;
      
      console.log("Updating user profile with image URL");
      
      // Update the user's profile with the new image URL
      const updatedUser = await storage.updateUser(req.user.id, {
        profileImageUrl: dataUrl
      });
      
      console.log('Profile image updated successfully');
      res.json({ 
        success: true, 
        message: "Profile image updated successfully",
        imageUrl: updatedUser.profileImageUrl
      });
    } catch (error) {
      console.error('Error updating profile image:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to update profile image" 
      });
    }
  });

  // User preferences routes
  app.get('/api/user/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      let preferences = await storage.getUserPreferences(req.user.id);
      if (!preferences) {
        // Create default preferences if none exist
        preferences = await storage.initializeDefaultUserPreferences(req.user.id);
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ message: "Failed to fetch user preferences" });
    }
  });

  app.put('/api/user/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const preferencesData = updateUserPreferencesSchema.parse(req.body);
      
      // Check if preferences exist, if not create them first
      let preferences = await storage.getUserPreferences(req.user.id);
      if (!preferences) {
        preferences = await storage.initializeDefaultUserPreferences(req.user.id);
      }
      
      const updatedPreferences = await storage.updateUserPreferences(req.user.id, preferencesData);
      res.json(updatedPreferences);
    } catch (error) {
      console.error("Error updating user preferences:", error);
      res.status(500).json({ message: "Failed to update user preferences" });
    }
  });

  // Categories routes
  app.get('/api/categories', requireAuth, async (req: AuthRequest, res: Response) => {
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

  app.put('/api/categories/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const categoryId = parseInt(req.params.id);
      
      // Verify category belongs to user
      const existingCategory = await storage.getCategoryById(categoryId, req.user.id);
      if (!existingCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      const categoryData = insertCategorySchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      const updatedCategory = await storage.updateCategory(categoryId, categoryData);
      res.json(updatedCategory);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/categories/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const categoryId = parseInt(req.params.id);
      
      // Verify category belongs to user
      const existingCategory = await storage.getCategoryById(categoryId, req.user.id);
      if (!existingCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      // Check if category is used in transactions
      const transactions = await storage.getTransactionsByCategory(categoryId, req.user.id);
      if (transactions.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete category that is used in transactions',
          usedInTransactions: transactions.length
        });
      }
      
      await storage.deleteCategory(categoryId, req.user.id);
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
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
      
      // Parse dan normalize tanggal ke Unix timestamp (seconds)
      let dateTimestamp;
      if (req.body.date) {
        const dateObj = new Date(req.body.date);
        dateTimestamp = Math.floor(dateObj.getTime() / 1000);
      } else {
        dateTimestamp = Math.floor(Date.now() / 1000);
      }
      
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        userId: req.user.id,
        date: dateTimestamp,
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
      
      // Parse dan normalize tanggal ke Unix timestamp (seconds) jika ada
      let updateData = { ...req.body };
      if (req.body.date) {
        const dateObj = new Date(req.body.date);
        updateData.date = Math.floor(dateObj.getTime() / 1000);
      }
      
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
          date: Math.floor(Date.now() / 1000),
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
      
      // Get user's categories and preferences for AI analysis
      const categories = await storage.getCategories(req.user.id);
      const userPreferences = await storage.getUserPreferences(req.user.id);
      
      // Create preferences object for AI analysis
      const aiPreferences = {
        defaultCurrency: userPreferences?.defaultCurrency || 'USD',
        language: userPreferences?.language || 'en',
        autoCategorize: userPreferences?.autoCategorize || false
      };
      
      const base64Image = req.file.buffer.toString('base64');
      const ocrResult = await processReceiptImage(base64Image, categories, aiPreferences);
      
      const createdTransactions = [];
      const newCategoriesCreated = [];
      
      for (const analysis of ocrResult.transactions) {
        // Find matching category (case-insensitive)
        let matchingCategory = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        // Auto-categorization: create new category if none exists and auto-categorize is enabled
        if (!matchingCategory && userPreferences?.autoCategorize && analysis.suggestedNewCategory) {
          console.log('Creating new category from OCR:', analysis.suggestedNewCategory);
          
          try {
            const newCategory = await storage.createCategory({
              name: analysis.suggestedNewCategory.name,
              icon: analysis.suggestedNewCategory.icon,
              color: analysis.suggestedNewCategory.color,
              type: analysis.suggestedNewCategory.type,
              userId: req.user.id,
              isDefault: false
            });
            
            matchingCategory = newCategory;
            newCategoriesCreated.push(newCategory);
            console.log('New category created from OCR:', newCategory);
          } catch (categoryError) {
            console.error('Failed to create new category from OCR:', categoryError);
          }
        }
        
        // Fallback to "Other" category if still no match
        if (!matchingCategory) {
          matchingCategory = categories.find(c => c.name.toLowerCase() === 'other');
        }
        
        if (matchingCategory) {
          const transactionData = insertTransactionSchema.parse({
            userId: req.user.id,
            categoryId: matchingCategory.id,
            amount: analysis.amount.toString(),
            currency: userPreferences?.defaultCurrency || "USD",
            description: analysis.description,
            type: analysis.type,
            date: Math.floor(Date.now() / 1000),
            aiGenerated: true,
          });
          
          const transaction = await storage.createTransaction(transactionData);
          createdTransactions.push(transaction);
        }
      }
      
      const currencySymbol = getCurrencySymbol(userPreferences?.defaultCurrency || 'USD');
      const successMessage = userPreferences?.language === 'id'
        ? `Dibuat ${createdTransactions.length} transaksi dari struk`
        : `Created ${createdTransactions.length} transactions from receipt`;
      
      res.json({ 
        ocrResult, 
        createdTransactions,
        newCategoriesCreated: newCategoriesCreated.length > 0 ? newCategoriesCreated : undefined,
        message: successMessage
      });
    } catch (error) {
      console.error("Error processing receipt:", error);
      
      // Try to get user preferences for error message language
      let errorMessage = "Failed to process receipt";
      try {
        const userPreferences = await storage.getUserPreferences(req.user!.id);
        errorMessage = userPreferences?.language === 'id'
          ? "Gagal memproses struk"
          : "Failed to process receipt";
      } catch (prefError) {
        console.error("Error getting user preferences for error message:", prefError);
      }
      
      res.status(500).json({ message: errorMessage });
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
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const id = parseInt(req.params.id);
      
      // Parse dan normalize tanggal ke Unix timestamp (seconds) jika ada
      let updateData = { ...req.body };
      if (req.body.startDate) {
        updateData.startDate = Math.floor((new Date(req.body.startDate)).getTime() / 1000);
      }
      if (req.body.endDate) {
        updateData.endDate = Math.floor((new Date(req.body.endDate)).getTime() / 1000);
      }
      
      const budget = await storage.updateBudget(id, updateData);
      res.json(budget);
    } catch (error) {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  app.delete('/api/budgets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const id = parseInt(req.params.id);
      await storage.deleteBudget(id);
      res.json({ message: "Budget deleted successfully" });
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // Adjust budget by category
  app.put('/api/budgets/adjust', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      console.log('=== BUDGET ADJUST REQUEST START ===');
      console.log('User:', req.user);
      console.log('Body:', req.body);
      
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const { category, newAmount, period = 'monthly', reason } = req.body;
      
      // Validation
      if (!category || !newAmount || newAmount <= 0) {
        return res.status(400).json({ message: "Category and valid amount are required" });
      }

      // Find category by name to get categoryId
      const categories = await storage.getCategories(req.user.id);
      const categoryObj = categories.find(cat => cat.name === category);
      
      if (!categoryObj) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Find the budget by categoryId
      const userBudgets = await storage.getBudgets(req.user.id);
      const existingBudget = userBudgets.find(budget => budget.categoryId === categoryObj.id);

      if (!existingBudget) {
        // Get user preferences for currency
        const userPreferences = await storage.getUserPreferences(req.user.id);
        const userCurrency = userPreferences?.defaultCurrency || 'IDR';
        
        // Create new budget if doesn't exist
        const newBudget = await storage.createBudget({
          userId: req.user.id,
          categoryId: categoryObj.id,
          amount: newAmount,
          currency: userCurrency,
          period: period,
          startDate: Math.floor(Date.now() / 1000),
          endDate: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
          isActive: true
        });

        const response = {
          message: "Budget created successfully",
          budget: newBudget,
          adjustment: {
            category,
            previousAmount: 0,
            newAmount,
            difference: newAmount,
            reason: reason || 'New budget created'
          }
        };
        
        console.log('=== BUDGET ADJUST RESPONSE (NEW) ===');
        console.log('Response:', response);
        console.log('=== BUDGET ADJUST REQUEST END ===');
        
        res.json(response);
        return;
      }

      // Update the existing budget
      const updatedBudget = await storage.updateBudget(existingBudget.id, {
        amount: newAmount,
        period: period
      });

      // Log the adjustment
      console.log(`Budget adjusted for user ${req.user.id}: ${category} from ${existingBudget.amount} to ${newAmount}. Reason: ${reason || 'Not specified'}`);

      const response = {
        message: "Budget adjusted successfully",
        budget: updatedBudget,
        adjustment: {
          category,
          previousAmount: existingBudget.amount,
          newAmount,
          difference: newAmount - existingBudget.amount,
          reason
        }
      };
      
      console.log('=== BUDGET ADJUST RESPONSE ===');
      console.log('Response:', response);
      console.log('=== BUDGET ADJUST REQUEST END ===');
      
      res.json(response);
    } catch (error) {
      console.error("=== BUDGET ADJUST ERROR ===");
      console.error("Error adjusting budget:", error);
      console.error("=== ERROR END ===");
      res.status(500).json({ message: "Failed to adjust budget" });
    }
  });

  // Set spending limit
  app.post('/api/budgets/spending-limits', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const { 
        category, 
        dailyLimit, 
        weeklyLimit, 
        monthlyLimit,
        enableDailyAlerts,
        enableWeeklyAlerts,
        hardLimit,
        warningThreshold
      } = req.body;
      
      console.log('=== SPENDING LIMITS REQUEST ===');
      console.log('User:', req.user.id);
      console.log('Payload:', req.body);
      
      // Validation
      if (!category) {
        return res.status(400).json({ message: "Category is required" });
      }

      if (!dailyLimit && !weeklyLimit && !monthlyLimit) {
        return res.status(400).json({ message: "At least one limit (daily, weekly, or monthly) is required" });
      }

      // Find category by name to get categoryId
      const categories = await storage.getCategories(req.user.id);
      const categoryObj = categories.find(cat => cat.name === category);
      
      if (!categoryObj) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Calculate monthly amount for budget storage
      let monthlyAmount = monthlyLimit;
      if (!monthlyAmount && dailyLimit) {
        monthlyAmount = dailyLimit * 30;
      } else if (!monthlyAmount && weeklyLimit) {
        monthlyAmount = weeklyLimit * 4;
      }

      // Check if spending limit (budget) already exists for this category
      const userBudgets = await storage.getBudgets(req.user.id);
      const existingBudget = userBudgets.find(budget => budget.categoryId === categoryObj.id);

      const limitMetadata = {
        type: 'spending_limit',
        dailyLimit: dailyLimit || null,
        weeklyLimit: weeklyLimit || null,
        monthlyLimit: monthlyAmount || null,
        enableDailyAlerts: enableDailyAlerts !== false,
        enableWeeklyAlerts: enableWeeklyAlerts !== false,
        hardLimit: hardLimit === true,
        warningThreshold: warningThreshold || 80,
        createdAt: Date.now()
      };

      console.log('=== LIMIT METADATA ===');
      console.log('Calculated monthly amount:', monthlyAmount);
      console.log('Limit metadata:', limitMetadata);

      if (existingBudget) {
        // Update existing budget with spending limit
        const updatedBudget = await storage.updateBudget(existingBudget.id, {
          amount: monthlyAmount,
          metadata: JSON.stringify(limitMetadata)
        });

        res.json({
          message: "Spending limits updated successfully",
          budget: updatedBudget,
          limits: {
            category,
            dailyLimit,
            weeklyLimit,
            monthlyLimit: monthlyAmount,
            enableDailyAlerts: limitMetadata.enableDailyAlerts,
            enableWeeklyAlerts: limitMetadata.enableWeeklyAlerts,
            hardLimit: limitMetadata.hardLimit,
            warningThreshold: limitMetadata.warningThreshold
          }
        });
        
        console.log('=== SPENDING LIMITS UPDATED ===');
        console.log('Budget updated:', updatedBudget);
      } else {
        // Get user preferences for currency
        const userPreferences = await storage.getUserPreferences(req.user.id);
        const userCurrency = userPreferences?.defaultCurrency || 'IDR';
        
        // Create new budget with spending limit
        const newBudget = await storage.createBudget({
          userId: req.user.id,
          categoryId: categoryObj.id,
          amount: monthlyAmount,
          currency: userCurrency,
          period: 'monthly',
          startDate: Math.floor(Date.now() / 1000),
          endDate: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
          metadata: JSON.stringify(limitMetadata),
          isActive: true
        });

        res.json({
          message: "Spending limits set successfully",
          budget: newBudget,
          limits: {
            category,
            dailyLimit,
            weeklyLimit,
            monthlyLimit: monthlyAmount,
            enableDailyAlerts: limitMetadata.enableDailyAlerts,
            enableWeeklyAlerts: limitMetadata.enableWeeklyAlerts,
            hardLimit: limitMetadata.hardLimit,
            warningThreshold: limitMetadata.warningThreshold
          }
        });
        
        console.log('=== SPENDING LIMITS CREATED ===');
        console.log('New budget:', newBudget);
      }
    } catch (error) {
      console.error("Error setting spending limits:", error);
      res.status(500).json({ message: "Failed to set spending limits" });
    }
  });

  // Goals routes
  app.get('/api/goals', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const goals = await storage.getGoals(req.user.id);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });
  
  app.get('/api/goals/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.getGoalById(goalId);
      
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      // Ensure the goal belongs to the authenticated user
      if (goal.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to this goal" });
      }
      
      res.json(goal);
    } catch (error) {
      console.error("Error fetching goal:", error);
      res.status(500).json({ message: "Failed to fetch goal details" });
    }
  });

  app.post('/api/goals', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const { name, targetAmount, currentAmount, deadline, category, description } = req.body;
      
      // Validation
      if (!name || !targetAmount || !deadline) {
        return res.status(400).json({ message: "Name, target amount, and deadline are required" });
      }
      
      if (targetAmount <= 0) {
        return res.status(400).json({ message: "Target amount must be greater than 0" });
      }
      
      if ((currentAmount || 0) >= targetAmount) {
        return res.status(400).json({ message: "Current amount cannot be greater than or equal to target amount" });
      }
      
      const goalData = {
        userId: req.user.id,
        name: name.toString(),
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount || 0),
        deadline: parseInt(deadline), // Unix timestamp
        category: category || 'other',
        description: description || '',
        isActive: true
      };
      
      const goal = await storage.createGoal(goalData);
      res.json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.put('/api/goals/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const id = parseInt(req.params.id);
      
      const { name, targetAmount, currentAmount, deadline, category, description, isActive } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.toString();
      if (targetAmount !== undefined) updateData.targetAmount = parseFloat(targetAmount);
      if (currentAmount !== undefined) updateData.currentAmount = parseFloat(currentAmount);
      if (deadline !== undefined) updateData.deadline = parseInt(deadline);
      if (category !== undefined) updateData.category = category;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const goal = await storage.updateGoal(id, updateData);
      res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete('/api/goals/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const id = parseInt(req.params.id);
      await storage.deleteGoal(id);
      res.json({ message: "Goal deleted successfully" });
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });
  
  // Helper function to calculate next contribution date based on frequency
  function calculateNextContributionDate(frequency: string): number {
    const now = new Date();
    let nextDate: Date;
    
    switch (frequency) {
      case 'weekly':
        nextDate = new Date(now.setDate(now.getDate() + 7));
        break;
      case 'biweekly':
        nextDate = new Date(now.setDate(now.getDate() + 14));
        break;
      case 'monthly':
      default:
        nextDate = new Date(now.setMonth(now.getMonth() + 1));
        break;
    }
    
    return Math.floor(nextDate.getTime() / 1000); // Unix timestamp
  }
  
  // Goal boost endpoint - add a one-time amount to the current goal amount
  app.post('/api/goals/:id/boost', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const goalId = parseInt(req.params.id);
      const { boostAmount } = req.body;
      
      if (!boostAmount || boostAmount <= 0) {
        return res.status(400).json({ message: "Boost amount must be a positive number" });
      }
      
      // Get current goal
      const goal = await storage.getGoalById(goalId);
      
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      if (goal.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to this goal" });
      }
      
      // Update the goal with new current amount
      const newCurrentAmount = goal.currentAmount + parseFloat(boostAmount);
      
      // Make sure we don't exceed the target amount
      const finalCurrentAmount = Math.min(newCurrentAmount, goal.targetAmount);
      
      const updatedGoal = await storage.updateGoal(goalId, {
        currentAmount: finalCurrentAmount
      });
      
      // Create a goal boost transaction record for tracking
      await storage.createGoalBoost(
        goalId,
        req.user.id,
        parseFloat(boostAmount),
        `Manual boost for goal: ${goal.name}`
      );
      
      res.json({
        success: true,
        message: "Goal boosted successfully",
        goal: updatedGoal
      });
    } catch (error) {
      console.error("Error boosting goal:", error);
      res.status(500).json({ message: "Failed to boost goal" });
    }
  });
  
  // Goal savings plan endpoint - set up recurring savings plan
  app.post('/api/goals/:id/savings-plan', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const goalId = parseInt(req.params.id);
      const { additionalAmount, frequency, isActive } = req.body;
      
      if (!additionalAmount || additionalAmount <= 0) {
        return res.status(400).json({ message: "Additional savings amount must be a positive number" });
      }
      
      // Valid frequencies: 'weekly', 'biweekly', 'monthly'
      if (!['weekly', 'biweekly', 'monthly'].includes(frequency)) {
        return res.status(400).json({ message: "Invalid frequency. Must be 'weekly', 'biweekly', or 'monthly'" });
      }
      
      // Get current goal
      const goal = await storage.getGoalById(goalId);
      
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      if (goal.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to this goal" });
      }
      
      // Create a new savings plan
      const savingsPlan = await storage.createGoalSavingsPlan(
        goalId,
        req.user.id,
        parseFloat(additionalAmount),
        frequency
      );
      
      res.json({
        success: true,
        message: "Savings plan updated successfully",
        savingsPlan
      });
    } catch (error) {
      console.error("Error setting up savings plan:", error);
      res.status(500).json({ message: "Failed to set up savings plan" });
    }
  });

  // Analytics routes
  app.get('/api/analytics/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      // Get comprehensive dashboard data from backend with all calculations
      const dashboardData = await storage.getDashboardAnalytics(req.user.id);
      
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard analytics" });
    }
  });

  // Live Cash Flow API - fully optimized for mixed timestamp formats and correct weekly grouping
  app.get('/api/analytics/cash-flow', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      console.log(`Fetching live cash flow data for user: ${userId}`);
      const cashFlowData = await storage.getLiveCashFlow(userId);
      
      // Format currency values for better frontend handling with improved date labeling
      const formattedData = {
        ...cashFlowData,
        // Format the trend data for charting with improved week labeling
        cashFlowTrend: cashFlowData.cashFlowTrend.map(item => {
          // Generate a more descriptive label including date range
          const startDate = new Date(item.weekStart).getDate();
          const endDate = new Date(item.weekEnd).getDate();
          const endMonth = new Date(item.weekEnd).toLocaleString('default', { month: 'short' });
          
          // Format: "1-7 Jul" or if crossing months: "29 Jun-5 Jul"
          let weekLabel;
          if (new Date(item.weekStart).getMonth() === new Date(item.weekEnd).getMonth()) {
            // Same month
            weekLabel = `${startDate}-${endDate} ${endMonth}`;
          } else {
            // Different months
            const startMonth = new Date(item.weekStart).toLocaleString('default', { month: 'short' });
            weekLabel = `${startDate} ${startMonth}-${endDate} ${endMonth}`;
          }
          
          return {
            date: item.date,
            label: weekLabel,
            weekStart: item.weekStart,
            weekEnd: item.weekEnd,
            amount: Number(item.amount)
          };
        })
      };
      
      console.log('Formatted cash flow trend data:', 
        formattedData.cashFlowTrend.map(i => `${i.label}: ${i.amount}`)
      );
      
      res.json({
        success: true,
        data: formattedData
      });
    } catch (error) {
      console.error("Error fetching cash flow data:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch cash flow data",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Chat completion endpoint
  app.post('/api/chat/completions', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "Invalid messages format" });
      }
      
      // Call OpenAI chat completion API
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-nano', // Use the latest model
        messages: messages,
        temperature: 0.7,
        max_tokens: 150,
      });
      
      const completion = response.choices[0]?.message?.content?.trim();
      
      res.json({
        success: true,
        completion
      });
    } catch (error) {
      console.error("Error processing chat completion:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to process chat completion",
        error: error instanceof Error ? error.message : String(error)
      });
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
            date: Math.floor(Date.now() / 1000), // Use seconds timestamp
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

  // Chat AI routes
  app.post('/api/chat/process', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      console.log('Chat request received:', req.body);
      const { message, type } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ 
          success: false,
          message: "Please provide a valid message" 
        });
      }

      console.log('Analyzing message with OpenAI:', message);
      
      // Get user's categories and preferences
      const [categories, userPreferences] = await Promise.all([
        storage.getCategories(req.user!.id),
        storage.getUserPreferences(req.user!.id)
      ]);
      
      // Create a simplified preferences object for OpenAI
      const aiPreferences = userPreferences ? {
        defaultCurrency: userPreferences.defaultCurrency,
        language: userPreferences.language,
        autoCategorize: userPreferences.autoCategorize || false
      } : undefined;
      
      // Use existing AI analysis function with categories and preferences
      const analysis = await analyzeTransactionText(message, categories, aiPreferences);
      console.log('AI Analysis result:', analysis);
      
      if (analysis.confidence > 0.7) {
        // Find matching category or create new one if auto-categorize is enabled
        let matchingCategory = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        // Auto-categorization: create new category if none exists and auto-categorize is enabled
        if (!matchingCategory && userPreferences?.autoCategorize && analysis.suggestedNewCategory) {
          console.log('Creating new category:', analysis.suggestedNewCategory);
          
          try {
            const newCategory = await storage.createCategory({
              name: analysis.suggestedNewCategory.name,
              icon: analysis.suggestedNewCategory.icon,
              color: analysis.suggestedNewCategory.color,
              type: analysis.suggestedNewCategory.type,
              userId: req.user!.id,
              isDefault: false
            });
            
            matchingCategory = newCategory;
            console.log('New category created:', newCategory);
          } catch (categoryError) {
            console.error('Failed to create new category:', categoryError);
          }
        }
        
        // Fallback to "Other" category if still no match
        if (!matchingCategory) {
          matchingCategory = categories.find(c => c.name.toLowerCase() === 'other');
        }
        
        if (matchingCategory) {
          const validatedData = insertTransactionSchema.parse({
            userId: req.user!.id,
            categoryId: matchingCategory.id,
            amount: analysis.amount,
            currency: userPreferences?.defaultCurrency || "USD",
            description: analysis.description,
            type: analysis.type,
            date: Math.floor(Date.now() / 1000),
            aiGenerated: true,
          });

          const transaction = await storage.createTransaction(validatedData);
          
          const currencySymbol = getCurrencySymbol(userPreferences?.defaultCurrency || 'USD');
          const successMessage = userPreferences?.language === 'id' 
            ? `Berhasil! Saya telah membuat transaksi ${analysis.type}: "${analysis.description}" sebesar ${currencySymbol}${analysis.amount}. 💰`
            : `Great! I've created a ${analysis.type} transaction: "${analysis.description}" for ${currencySymbol}${analysis.amount}. 💰`;
          
          return res.json({
            success: true,
            transaction,
            message: successMessage,
            newCategoryCreated: analysis.suggestedNewCategory ? true : false
          });
        } else {
          const currencySymbol = getCurrencySymbol(userPreferences?.defaultCurrency || 'USD');
          const errorMessage = userPreferences?.language === 'id'
            ? `Saya menemukan ${analysis.type} sebesar ${currencySymbol}${analysis.amount} untuk "${analysis.description}", tetapi tidak dapat menemukan kategori yang cocok.`
            : `I found a ${analysis.type} of ${currencySymbol}${analysis.amount} for "${analysis.description}", but couldn't find a matching category.`;
            
          return res.json({
            success: false,
            message: errorMessage
          });
        }
      } else {
        // Return analysis for user to review
        return res.json({
          success: false,
          analysis: analysis,
          message: `I found a ${analysis.type} of $${analysis.amount} for "${analysis.description}". Should I create this transaction?`
        });
      }
    } catch (error) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ 
        success: false,
        message: "Sorry, I encountered an error processing your message. Please try again."
      });
    }
  });

  app.post('/api/chat/voice', requireAuth, upload.single('audio'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          message: "No audio file provided" 
        });
      }

      console.log('Processing voice message...', {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
      
      // Get user preferences first for language-aware transcription
      const userPreferences = await storage.getUserPreferences(req.user!.id);
      
      // Create a proper file-like object for OpenAI Whisper
      const audioFile = new File([req.file.buffer], req.file.originalname || 'audio.webm', { 
        type: req.file.mimetype || 'audio/webm' 
      });

      // Use OpenAI Whisper for speech-to-text
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: userPreferences?.language || 'en', // Use user's preferred language
        response_format: 'text',
        temperature: 0.2,
      });

      const transcribedText = transcription.trim();
      console.log('Transcribed text:', transcribedText);

      if (!transcribedText || transcribedText.length === 0) {
        const noAudioMessage = userPreferences?.language === 'id'
          ? "🎤 Saya tidak dapat mendengar dengan jelas. Silakan coba berbicara lebih jelas dan pastikan mikrofon Anda berfungsi."
          : "🎤 I couldn't hear anything clearly. Please try speaking more clearly and ensure your microphone is working.";
          
        return res.json({
          success: false,
          transcription: transcribedText,
          message: noAudioMessage
        });
      }

      // Get user's categories for AI analysis
      const categories = await storage.getCategories(req.user!.id);
      
      // Create preferences object for AI analysis
      const aiPreferences = {
        defaultCurrency: userPreferences?.defaultCurrency || 'USD',
        language: userPreferences?.language || 'en',
        autoCategorize: userPreferences?.autoCategorize || false
      };
      
      // Analyze the transcribed text with user preferences
      const analysis = await analyzeTransactionText(transcribedText, categories, aiPreferences);
      console.log('Voice analysis result:', analysis);

      if (analysis.confidence > 0.6) {
        // Create transaction directly for reasonable confidence
        let matchingCategory = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        // Auto-categorization: create new category if none exists and auto-categorize is enabled
        if (!matchingCategory && userPreferences?.autoCategorize && analysis.suggestedNewCategory) {
          console.log('Creating new category from voice:', analysis.suggestedNewCategory);
          
          try {
            const newCategory = await storage.createCategory({
              name: analysis.suggestedNewCategory.name,
              icon: analysis.suggestedNewCategory.icon,
              color: analysis.suggestedNewCategory.color,
              type: analysis.suggestedNewCategory.type,
              userId: req.user!.id,
              isDefault: false
            });
            
            matchingCategory = newCategory;
            console.log('New category created from voice:', newCategory);
          } catch (categoryError) {
            console.error('Failed to create new category from voice:', categoryError);
          }
        }
        
        // Fallback to "Other" category if still no match
        if (!matchingCategory) {
          matchingCategory = categories.find(c => c.name.toLowerCase() === 'other');
        }
        
        if (matchingCategory && analysis.amount > 0) {
          try {
            const validatedData = insertTransactionSchema.parse({
              userId: req.user!.id,
              categoryId: matchingCategory.id,
              amount: parseFloat(analysis.amount.toString()),
              currency: userPreferences?.defaultCurrency || "USD",
              description: analysis.description,
              type: analysis.type,
              date: Math.floor(Date.now() / 1000),
              aiGenerated: true,
            });

            const transaction = await storage.createTransaction(validatedData);
            console.log('Created transaction from voice:', transaction);
            
            const currencySymbol = getCurrencySymbol(userPreferences?.defaultCurrency || 'USD');
            const successMessage = userPreferences?.language === 'id'
              ? `🎤 Saya mendengar: "${transcribedText}"\n\n✅ Dibuat ${analysis.type}: "${analysis.description}" sebesar ${currencySymbol}${analysis.amount}\n\nTransaksi berhasil ditambahkan! 🎉`
              : `🎤 I heard: "${transcribedText}"\n\n✅ Created ${analysis.type}: "${analysis.description}" for ${currencySymbol}${analysis.amount}\n\nTransaction added successfully! 🎉`;
            
            return res.json({
              success: true,
              transaction,
              transcription: transcribedText,
              analysisResult: analysis,
              message: successMessage,
              newCategoryCreated: analysis.suggestedNewCategory ? true : false
            });
          } catch (validationError) {
            console.error('Transaction validation error:', validationError);
            const currencySymbol = getCurrencySymbol(userPreferences?.defaultCurrency || 'USD');
            const errorMessage = userPreferences?.language === 'id'
              ? `🎤 Saya mendengar: "${transcribedText}"\n\n❌ Saya memahami Anda ingin mencatat ${analysis.type} sebesar ${currencySymbol}${analysis.amount} untuk "${analysis.description}", tetapi terjadi kesalahan saat membuat transaksi. Silakan coba lagi.`
              : `🎤 I heard: "${transcribedText}"\n\n❌ I understood you want to record a ${analysis.type} of ${currencySymbol}${analysis.amount} for "${analysis.description}", but there was an error creating the transaction. Please try again.`;
              
            return res.json({
              success: false,
              transcription: transcribedText,
              analysisResult: analysis,
              message: errorMessage
            });
          }
        } else {
          const currencySymbol = getCurrencySymbol(userPreferences?.defaultCurrency || 'USD');
          const categoryErrorMessage = userPreferences?.language === 'id'
            ? `🎤 Saya mendengar: "${transcribedText}"\n\n🤔 Saya menemukan ${analysis.type} sebesar ${currencySymbol}${analysis.amount} untuk "${analysis.description}", tetapi tidak dapat menemukan kategori yang cocok "${analysis.category}" di akun Anda. Pastikan Anda memiliki kategori yang tepat.`
            : `🎤 I heard: "${transcribedText}"\n\n🤔 I found a ${analysis.type} of ${currencySymbol}${analysis.amount} for "${analysis.description}", but couldn't find a matching category "${analysis.category}" in your account. Please make sure you have the right categories set up.`;
            
          return res.json({
            success: false,
            transcription: transcribedText,
            analysisResult: analysis,
            message: categoryErrorMessage
          });
        }
      } else {
        const currencySymbol = getCurrencySymbol(userPreferences?.defaultCurrency || 'USD');
        const lowConfidenceMessage = userPreferences?.language === 'id'
          ? `🎤 Saya mendengar: "${transcribedText}"\n\n🤔 Saya rasa Anda mungkin menyebutkan ${analysis.type} sebesar ${currencySymbol}${analysis.amount} untuk "${analysis.description}", tetapi saya tidak yakin sepenuhnya. Bisakah Anda coba lagi dengan detail yang lebih jelas?`
          : `🎤 I heard: "${transcribedText}"\n\n🤔 I think you might be mentioning a ${analysis.type} of ${currencySymbol}${analysis.amount} for "${analysis.description}", but I'm not completely sure. Could you please try again with more details?`;
          
        return res.json({
          success: false,
          transcription: transcribedText,
          analysisResult: analysis,
          message: lowConfidenceMessage
        });
      }
    } catch (error) {
      console.error("Error processing voice message:", error);
      
      // Try to get user preferences for error message language
      let errorMessage = "Sorry, I couldn't process your voice message. Please try again.";
      try {
        const userPreferences = await storage.getUserPreferences(req.user!.id);
        errorMessage = userPreferences?.language === 'id'
          ? "Maaf, saya tidak dapat memproses pesan suara Anda. Silakan coba lagi."
          : "Sorry, I couldn't process your voice message. Please try again.";
      } catch (prefError) {
        console.error("Error getting user preferences for error message:", prefError);
      }
      
      res.status(500).json({ 
        success: false,
        message: errorMessage,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post('/api/chat/image', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          message: "No image file provided" 
        });
      }

      console.log('Processing image receipt...');
      
      // Get user's categories and preferences for AI analysis
      const categories = await storage.getCategories(req.user!.id);
      const userPreferences = await storage.getUserPreferences(req.user!.id);
      
      // Create preferences object for AI analysis
      const aiPreferences = {
        defaultCurrency: userPreferences?.defaultCurrency || 'USD',
        language: userPreferences?.language || 'en',
        autoCategorize: userPreferences?.autoCategorize || false
      };

      // Use receipt processing function with dynamic categories and user preferences
      const base64Image = req.file.buffer.toString('base64');
      const result = await processReceiptImage(base64Image, categories, aiPreferences);
      
      console.log('Image analysis result:', result);
      
      if (result.transactions && result.transactions.length > 0) {
        // Create transactions from the image
        const createdTransactions = [];
        const newCategoriesCreated = [];
        
        for (const analysis of result.transactions) {
          // Find matching category (case-insensitive)
          let matchingCategory = categories.find(c => 
            c.name.toLowerCase() === analysis.category.toLowerCase()
          );
          
          // Auto-categorization: create new category if none exists and auto-categorize is enabled
          if (!matchingCategory && userPreferences?.autoCategorize && analysis.suggestedNewCategory) {
            console.log('Creating new category from image:', analysis.suggestedNewCategory);
            
            try {
              const newCategory = await storage.createCategory({
                name: analysis.suggestedNewCategory.name,
                icon: analysis.suggestedNewCategory.icon,
                color: analysis.suggestedNewCategory.color,
                type: analysis.suggestedNewCategory.type,
                userId: req.user!.id,
                isDefault: false
              });
              
              matchingCategory = newCategory;
              newCategoriesCreated.push(newCategory);
              console.log('New category created from image:', newCategory);
            } catch (categoryError) {
              console.error('Failed to create new category from image:', categoryError);
            }
          }
          
          // Fallback to "Other" category if still no match
          if (!matchingCategory) {
            matchingCategory = categories.find(c => c.name.toLowerCase() === 'other');
          }
          
          if (matchingCategory && analysis.amount > 0) {
            try {
              const validatedData = insertTransactionSchema.parse({
                userId: req.user!.id,
                categoryId: matchingCategory.id,
                amount: parseFloat(analysis.amount.toString()),
                currency: userPreferences?.defaultCurrency || "USD",
                description: analysis.description,
                type: analysis.type || 'expense',
                date: Math.floor(Date.now() / 1000),
                aiGenerated: true,
              });
              
              const transaction = await storage.createTransaction(validatedData);
              createdTransactions.push(transaction);
              console.log('Created transaction from image:', transaction);
            } catch (validationError) {
              console.error('Transaction validation error:', validationError);
              continue;
            }
          } else {
            console.log('No matching category found for:', analysis.category);
          }
        }
        
        if (createdTransactions.length > 0) {
          const currencySymbol = getCurrencySymbol(userPreferences?.defaultCurrency || 'USD');
          const successMessage = userPreferences?.language === 'id'
            ? `📸 Sempurna! Saya menganalisis struk Anda dan menemukan ${createdTransactions.length} transaksi:\n\n${createdTransactions.map(t => `✅ ${t.description} - ${currencySymbol}${t.amount}`).join('\n')}\n\nSemua transaksi telah ditambahkan ke akun Anda! 🎉`
            : `📸 Perfect! I analyzed your receipt and found ${createdTransactions.length} transaction${createdTransactions.length > 1 ? 's' : ''}:\n\n${createdTransactions.map(t => `✅ ${t.description} - ${currencySymbol}${t.amount}`).join('\n')}\n\nAll transactions have been added to your account! 🎉`;
            
          return res.json({
            success: true,
            transactions: createdTransactions,
            analysisResult: result,
            message: successMessage,
            newCategoriesCreated: newCategoriesCreated.length > 0 ? newCategoriesCreated : undefined
          });
        } else {
          const currencySymbol = getCurrencySymbol(userPreferences?.defaultCurrency || 'USD');
          const noMatchMessage = userPreferences?.language === 'id'
            ? `📸 Saya dapat melihat beberapa detail transaksi di struk Anda, tetapi tidak dapat mencocokkannya dengan kategori yang ada. Ini yang saya temukan:\n\n${result.transactions.map(t => `• ${t.description} - ${currencySymbol}${t.amount} (${t.category})`).join('\n')}\n\nPastikan Anda memiliki kategori yang tepat di akun Anda.`
            : `📸 I could see some transaction details in your receipt, but couldn't match them to your existing categories. Here's what I found:\n\n${result.transactions.map(t => `• ${t.description} - ${currencySymbol}${t.amount} (${t.category})`).join('\n')}\n\nPlease make sure you have the right categories set up in your account.`;
            
          return res.json({
            success: false,
            analysisResult: result,
            message: noMatchMessage
          });
        }
      } else {
        const noDetailsMessage = userPreferences?.language === 'id'
          ? "📸 Saya tidak dapat menemukan detail transaksi yang jelas dalam gambar ini. Pastikan itu adalah struk yang jelas dengan jumlah dan informasi pedagang yang terlihat. Coba ambil foto dalam pencahayaan yang baik dan pastikan teksnya dapat dibaca."
          : "📸 I couldn't find any clear transaction details in this image. Please make sure it's a clear receipt with visible amounts and merchant information. Try taking the photo in good lighting and ensure the text is readable.";
          
        return res.json({
          success: false,
          analysisResult: result,
          message: noDetailsMessage
        });
      }
    } catch (error) {
      console.error("Error processing image:", error);
      
      // Try to get user preferences for error message language
      let errorMessage = "Sorry, I couldn't process that image. Please try uploading a clearer receipt.";
      try {
        const userPreferences = await storage.getUserPreferences(req.user!.id);
        errorMessage = userPreferences?.language === 'id'
          ? "Maaf, saya tidak dapat memproses gambar itu. Silakan coba unggah struk yang lebih jelas."
          : "Sorry, I couldn't process that image. Please try uploading a clearer receipt.";
      } catch (prefError) {
        console.error("Error getting user preferences for error message:", prefError);
      }
      
      res.status(500).json({ 
        success: false,
        message: errorMessage,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // AI Financial Intelligence endpoints
  app.get("/api/ai/financial-intelligence", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const userId = req.user.id;
      const aiEngine = new AIFinancialIntelligenceEngine(userId);
      const intelligence = await aiEngine.generateIntelligence();
      
      res.json({
        success: true,
        data: intelligence
      });
    } catch (error) {
      console.error("AI Financial Intelligence error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to generate AI financial intelligence" 
      });
    }
  });

  // Individual AI analysis endpoints
  app.get("/api/ai/spending-opportunities", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const userId = req.user.id;
      const aiEngine = new AIFinancialIntelligenceEngine(userId);
      const intelligence = await aiEngine.generateIntelligence();
      
      res.json({
        success: true,
        data: intelligence.smartSpendingOpportunities
      });
    } catch (error) {
      console.error("Smart Spending Opportunities error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to generate spending opportunities" 
      });
    }
  });

  app.get("/api/ai/budget-alerts", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const userId = req.user.id;
      const aiEngine = new AIFinancialIntelligenceEngine(userId);
      const intelligence = await aiEngine.generateIntelligence();
      
      res.json({
        success: true,
        data: intelligence.budgetAlerts
      });
    } catch (error) {
      console.error("Budget Alerts error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to generate budget alerts" 
      });
    }
  });

  app.get("/api/ai/goal-forecasts", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const userId = req.user.id;
      console.log('Goal forecasts request for userId:', userId, typeof userId);
      const aiEngine = new AIFinancialIntelligenceEngine(userId);
      const intelligence = await aiEngine.generateIntelligence();
      console.log('Generated intelligence goalForecasts:', intelligence.goalForecasts);
      
      res.json({
        success: true,
        data: intelligence.goalForecasts
      });
    } catch (error) {
      console.error("Goal Forecasts error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to generate goal forecasts" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
