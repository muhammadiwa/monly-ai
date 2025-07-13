import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeTransactionText, processReceiptImage } from "./openai";
import { insertTransactionSchema, insertBudgetSchema, insertCategorySchema } from "@shared/schema";
import { requireAuth, hashPassword, verifyPassword, generateToken, type AuthRequest } from "./auth";
import multer from "multer";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import OpenAI from "openai";

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
            date: Date.now(), // Use milliseconds timestamp
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
            date: Date.now(), // Use milliseconds timestamp
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
      
      // Get user's categories first
      const categories = await storage.getCategories(req.user!.id);
      
      // Use existing AI analysis function with categories
      const analysis = await analyzeTransactionText(message, categories);
      console.log('AI Analysis result:', analysis);
      
      if (analysis.confidence > 0.7) {
        // Create transaction directly for high confidence
        const categories = await storage.getCategories(req.user!.id);
        const matchingCategory = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        if (matchingCategory) {
          const validatedData = insertTransactionSchema.parse({
            userId: req.user!.id,
            categoryId: matchingCategory.id,
            amount: analysis.amount,
            currency: "USD",
            description: analysis.description,
            type: analysis.type,
            date: Date.now(), // Use milliseconds timestamp
            aiGenerated: true,
          });

          const transaction = await storage.createTransaction(validatedData);
          
          return res.json({
            success: true,
            transaction,
            message: `Great! I've created a ${analysis.type} transaction: "${analysis.description}" for $${analysis.amount}. 💰`
          });
        } else {
          return res.json({
            success: false,
            message: `I found a ${analysis.type} of $${analysis.amount} for "${analysis.description}", but couldn't find a matching category "${analysis.category}". Please create this category first or be more specific.`
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
      
      // Create a proper file-like object for OpenAI Whisper
      const audioFile = new File([req.file.buffer], req.file.originalname || 'audio.webm', { 
        type: req.file.mimetype || 'audio/webm' 
      });

      // Use OpenAI Whisper for speech-to-text
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en', // or 'id' for Indonesian
        response_format: 'text',
        temperature: 0.2,
      });

      const transcribedText = transcription.trim();
      console.log('Transcribed text:', transcribedText);

      if (!transcribedText || transcribedText.length === 0) {
        return res.json({
          success: false,
          transcription: transcribedText,
          message: "🎤 I couldn't hear anything clearly. Please try speaking more clearly and ensure your microphone is working."
        });
      }

      // Get user's categories for AI analysis
      const categories = await storage.getCategories(req.user!.id);
      
      // Analyze the transcribed text
      const analysis = await analyzeTransactionText(transcribedText, categories);
      console.log('Voice analysis result:', analysis);

      if (analysis.confidence > 0.6) {
        // Create transaction directly for reasonable confidence
        const matchingCategory = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        if (matchingCategory && analysis.amount > 0) {
          try {
            const validatedData = insertTransactionSchema.parse({
              userId: req.user!.id,
              categoryId: matchingCategory.id,
              amount: parseFloat(analysis.amount.toString()),
              currency: "USD",
              description: analysis.description,
              type: analysis.type,
              date: Date.now(),
              aiGenerated: true,
            });

            const transaction = await storage.createTransaction(validatedData);
            console.log('Created transaction from voice:', transaction);
            
            return res.json({
              success: true,
              transaction,
              transcription: transcribedText,
              analysisResult: analysis,
              message: `🎤 I heard: "${transcribedText}"\n\n✅ Created ${analysis.type}: "${analysis.description}" for $${analysis.amount}\n\nTransaction added successfully! 🎉`
            });
          } catch (validationError) {
            console.error('Transaction validation error:', validationError);
            return res.json({
              success: false,
              transcription: transcribedText,
              analysisResult: analysis,
              message: `🎤 I heard: "${transcribedText}"\n\n❌ I understood you want to record a ${analysis.type} of $${analysis.amount} for "${analysis.description}", but there was an error creating the transaction. Please try again.`
            });
          }
        } else {
          return res.json({
            success: false,
            transcription: transcribedText,
            analysisResult: analysis,
            message: `🎤 I heard: "${transcribedText}"\n\n🤔 I found a ${analysis.type} of $${analysis.amount} for "${analysis.description}", but couldn't find a matching category "${analysis.category}" in your account. Please make sure you have the right categories set up.`
          });
        }
      } else {
        return res.json({
          success: false,
          transcription: transcribedText,
          analysisResult: analysis,
          message: `🎤 I heard: "${transcribedText}"\n\n🤔 I think you might be mentioning a ${analysis.type} of $${analysis.amount} for "${analysis.description}", but I'm not completely sure. Could you please try again with more details?`
        });
      }
    } catch (error) {
      console.error("Error processing voice message:", error);
      res.status(500).json({ 
        success: false,
        message: "Sorry, I couldn't process your voice message. Please try again.",
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
      
      // Get user's categories for AI analysis
      const categories = await storage.getCategories(req.user!.id);

      // Use receipt processing function with dynamic categories
      const base64Image = req.file.buffer.toString('base64');
      const result = await processReceiptImage(base64Image, categories);
      
      console.log('Image analysis result:', result);
      
      if (result.transactions && result.transactions.length > 0) {
        // Create transactions from the image
        const createdTransactions = [];
        
        for (const analysis of result.transactions) {
          // Find matching category (case-insensitive)
          const matchingCategory = categories.find(c => 
            c.name.toLowerCase() === analysis.category.toLowerCase()
          );
          
          if (matchingCategory && analysis.amount > 0) {
            try {
              const validatedData = insertTransactionSchema.parse({
                userId: req.user!.id,
                categoryId: matchingCategory.id,
                amount: parseFloat(analysis.amount.toString()),
                currency: "USD",
                description: analysis.description,
                type: analysis.type || 'expense',
                date: Date.now(),
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
          return res.json({
            success: true,
            transactions: createdTransactions,
            analysisResult: result,
            message: `📸 Perfect! I analyzed your receipt and found ${createdTransactions.length} transaction${createdTransactions.length > 1 ? 's' : ''}:\n\n${createdTransactions.map(t => `✅ ${t.description} - $${t.amount}`).join('\n')}\n\nAll transactions have been added to your account! 🎉`
          });
        } else {
          return res.json({
            success: false,
            analysisResult: result,
            message: `📸 I could see some transaction details in your receipt, but couldn't match them to your existing categories. Here's what I found:\n\n${result.transactions.map(t => `• ${t.description} - $${t.amount} (${t.category})`).join('\n')}\n\nPlease make sure you have the right categories set up in your account.`
          });
        }
      } else {
        return res.json({
          success: false,
          analysisResult: result,
          message: "📸 I couldn't find any clear transaction details in this image. Please make sure it's a clear receipt with visible amounts and merchant information. Try taking the photo in good lighting and ensure the text is readable."
        });
      }
    } catch (error) {
      console.error("Error processing image:", error);
      res.status(500).json({ 
        success: false,
        message: "Sorry, I couldn't process that image. Please try uploading a clearer receipt.",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
