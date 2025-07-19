import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import OpenAI from 'openai';
import { analyzeTransactionText, processReceiptImage, analyzeFinancialProfile, generateBudgetRecommendations } from './openai';
import { storage } from './storage';

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "default_key"
});

// Type definitions for WhatsApp Web.js
type WAClient = InstanceType<typeof Client>;
type WAMessage = any; // WhatsApp message type

interface WhatsAppConnection {
  client: WAClient;
  status: 'initializing' | 'loading_screen' | 'qr_received' | 'authenticated' | 'ready' | 'disconnected';
  qrCode: string | null;
  userId: string;
}

// Store WhatsApp connections by user ID
const connections: Map<string, WhatsAppConnection> = new Map();

/**
 * Initialize WhatsApp client for a user with enhanced message handling
 * @param userId The user ID to associate with the WhatsApp client
 * @returns The WhatsApp connection object
 */
export const initializeWhatsAppClient = (userId: string): WhatsAppConnection => {
  // Check if client already exists
  const existingConnection = connections.get(userId);
  if (existingConnection) {
    return existingConnection;
  }

  // Create a new client with local authentication
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
  });

  // Create connection object
  const connection: WhatsAppConnection = {
    client,
    status: 'initializing',
    qrCode: null,
    userId
  };

  // Set up event handlers
  client.on('qr', async (qr) => {
    console.log(`QR Code received for user ${userId}`);
    try {
      // Generate QR code as data URL
      connection.qrCode = await qrcode.toDataURL(qr);
      connection.status = 'qr_received';
    } catch (err) {
      console.error('Error generating QR code:', err);
      connection.qrCode = qr; // Fallback to raw QR string
      connection.status = 'qr_received';
    }
  });

  client.on('ready', () => {
    console.log(`WhatsApp client ready for user ${userId}`);
    connection.status = 'ready';
    connection.qrCode = null;
    
    // Register message handlers when client is ready
    registerMessageHandlers(userId);
    
    // Send welcome message to user's own number if possible
    client.getChats().then(chats => {
      console.log(`User ${userId} has ${chats.length} chats available`);
    }).catch(console.error);
  });

  client.on('authenticated', () => {
    console.log(`WhatsApp client authenticated for user ${userId}`);
    connection.status = 'authenticated';
  });

  client.on('auth_failure', (msg) => {
    console.error(`WhatsApp authentication failed for user ${userId}: ${msg}`);
    connection.status = 'disconnected';
  });

  client.on('disconnected', (reason) => {
    console.log(`WhatsApp client disconnected for user ${userId}: ${reason}`);
    connection.status = 'disconnected';
    
    // Clean up connection
    connections.delete(userId);
  });

  client.on('message_create', (message) => {
    // Log outgoing messages for debugging
    if (message.fromMe) {
      console.log(`Sent message to ${message.to}: ${message.body}`);
    }
  });

  // Store the connection
  connections.set(userId, connection);

  // Initialize the client
  client.initialize().catch((error) => {
    console.error(`Failed to initialize WhatsApp client for user ${userId}:`, error);
    connection.status = 'disconnected';
  });

  return connection;
};

/**
 * Get the current connection state for a user
 * @param userId The user ID to check
 * @returns The connection state or null if not connected
 */
export const getConnectionState = (userId: string) => {
  const connection = connections.get(userId);
  if (!connection) {
    return null;
  }

  return {
    status: connection.status,
    qrCode: connection.qrCode
  };
};

/**
 * Get all active connections
 * @returns Array of connection states
 */
export const getAllConnections = () => {
  const result = [];
  const entries = Array.from(connections.entries());
  for (const [userId, connection] of entries) {
    result.push({
      userId,
      status: connection.status,
      qrCode: connection.qrCode
    });
  }
  return result;
};

/**
 * Initialize WhatsApp client for specific user (used by multi-account system)
 * @param userId The user ID to initialize client for
 * @returns Promise with connection result
 */
export const initializeUserWhatsAppClient = async (userId: string): Promise<{ success: boolean; status: string; qrCode?: string; message?: string }> => {
  try {
    // Check if user already has an active connection
    const existingConnection = connections.get(userId);
    if (existingConnection) {
      if (existingConnection.status === 'ready' || existingConnection.status === 'authenticated') {
        return {
          success: true,
          status: existingConnection.status,
          message: 'WhatsApp already connected'
        };
      } else if (existingConnection.status === 'qr_received' && existingConnection.qrCode) {
        return {
          success: true,
          status: existingConnection.status,
          qrCode: existingConnection.qrCode
        };
      }
    }
    
    // Initialize new client
    const connection = initializeWhatsAppClient(userId);
    
    // Wait for QR code or ready state
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          status: 'timeout',
          message: 'Connection timeout'
        });
      }, 60000); // 60 second timeout
      
      const checkInterval = setInterval(() => {
        if (connection.qrCode && connection.status === 'qr_received') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: true,
            status: connection.status,
            qrCode: connection.qrCode
          });
        } else if (connection.status === 'ready' || connection.status === 'authenticated') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: true,
            status: connection.status,
            message: 'WhatsApp connected successfully'
          });
        } else if (connection.status === 'disconnected') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: false,
            status: connection.status,
            message: 'Connection failed'
          });
        }
      }, 1000);
    });
    
  } catch (error) {
    console.error('Error initializing user WhatsApp client:', error);
    return {
      success: false,
      status: 'error',
      message: 'Failed to initialize WhatsApp client'
    };
  }
};

/**
 * Disconnect specific user's WhatsApp client
 * @param userId The user ID to disconnect
 * @returns Promise with result
 */
export const disconnectUserWhatsApp = async (userId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const connection = connections.get(userId);
    if (!connection) {
      return {
        success: false,
        message: 'No WhatsApp connection found for this user'
      };
    }
    
    await connection.client.destroy();
    connections.delete(userId);
    
    return {
      success: true,
      message: 'WhatsApp disconnected successfully'
    };
  } catch (error) {
    console.error('Error disconnecting user WhatsApp:', error);
    return {
      success: false,
      message: 'Failed to disconnect WhatsApp'
    };
  }
};

/**
 * Send a message to specific WhatsApp number (for notifications)
 * @param userId The user ID
 * @param whatsappNumber The target WhatsApp number
 * @param message The message to send
 * @returns Promise with result
 */
export const sendWhatsAppMessage = async (
  userId: string, 
  whatsappNumber: string, 
  message: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const connection = connections.get(userId);
    if (!connection || connection.status !== 'ready') {
      return {
        success: false,
        message: 'WhatsApp client not ready'
      };
    }
    
    // Format the number correctly
    const chatId = whatsappNumber.includes('@c.us') ? whatsappNumber : `${whatsappNumber}@c.us`;
    
    await connection.client.sendMessage(chatId, message);
    
    return {
      success: true
    };
    
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return {
      success: false,
      message: 'Failed to send message'
    };
  }
};

/**
 * Get the current WhatsApp connection status (legacy function for backward compatibility)
 * @deprecated Use getConnectionState(userId) instead
 */
export const getWhatsAppConnectionStatus = () => {
  // For backward compatibility, return the first connection's status
  if (connections.size === 0) {
    return {
      connected: false,
      status: 'disconnected'
    };
  }

  const firstConnection = Array.from(connections.values())[0];
  return {
    connected: firstConnection.status === 'ready' || firstConnection.status === 'authenticated',
    status: firstConnection.status,
    qrCode: firstConnection.qrCode
  };
};

/**
 * Generate QR code for WhatsApp Web connection (legacy function)
 * @deprecated Use initializeUserWhatsAppClient(userId) instead
 */
export const generateQRCode = async (): Promise<{ success: boolean; status: string; qrCode?: string }> => {
  try {
    // Use a temporary user ID for demo purposes (backward compatibility)
    const tempUserId = 'default-user';
    
    const result = await initializeUserWhatsAppClient(tempUserId);
    return result;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return {
      success: false,
      status: 'error'
    };
  }
};

/**
 * Disconnect WhatsApp client (legacy function)
 * @deprecated Use disconnectUserWhatsApp(userId) instead
 */
export const disconnectWhatsApp = async (): Promise<{ success: boolean; message: string }> => {
  try {
    if (connections.size === 0) {
      return {
        success: false,
        message: 'No WhatsApp connections found'
      };
    }
    
    // Disconnect the first connection (for backward compatibility)
    const firstUserId = Array.from(connections.keys())[0];
    return await disconnectUserWhatsApp(firstUserId);
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    return {
      success: false,
      message: 'Failed to disconnect WhatsApp'
    };
  }
};

/**
 * Register message handlers for financial operations with full AI integration
 * @param userId The user ID to register handlers for
 */
export const registerMessageHandlers = (userId: string): boolean => {
  const connection = connections.get(userId);
  if (!connection || connection.status !== 'ready') {
    return false;
  }

  // Handle incoming messages with comprehensive AI processing
  connection.client.on('message', async (message: WAMessage) => {
    console.log(`Message received from ${message.from}: ${message.body}`);
    
    // Get WhatsApp number without suffix
    const whatsappNumber = message.from.replace('@c.us', '');
    
    // Skip messages from groups or status updates
    if (message.from.includes('@g.us') || message.from.includes('status@broadcast')) {
      return;
    }
    
    // Get user ID from WhatsApp number
    const messageUserId = await getUserIdFromWhatsApp(whatsappNumber);
    
    if (!messageUserId) {
      // Check for activation command first
      const activationPattern = /^AKTIVASI:\s*([A-Z0-9]{6})$/i;
      const activationMatch = message.body.match(activationPattern);

      if (activationMatch) {
        await handleActivationCode(message, activationMatch[1].toUpperCase(), whatsappNumber);
      } else {
        await message.reply(
          `🔒 *Akun Belum Terhubung*\n\n` +
          `Nomor WhatsApp Anda belum terhubung ke akun Monly AI.\n\n` +
          `📱 *Cara Menghubungkan:*\n` +
          `1. Buka aplikasi Monly AI\n` +
          `2. Masuk ke menu "Integrasi WhatsApp"\n` +
          `3. Buat kode aktivasi\n` +
          `4. Kirim pesan: AKTIVASI: [KODE]\n\n` +
          `💡 Contoh: AKTIVASI: ABC123`
        );
      }
      return;
    }

    // Handle different message types for authenticated users
    try {
      // Handle text commands
      if (message.type === 'chat' && message.body) {
        const messageText = message.body.toLowerCase().trim();
        
        // Special commands
        if (messageText === 'bantuan' || messageText === 'help') {
          await showHelpMessage(message);
          return;
        }
        
        if (messageText === 'saldo' || messageText === 'balance' || messageText === 'ringkasan') {
          await showBalanceSummary(message, messageUserId);
          return;
        }
        
        if (messageText === 'status') {
          await message.reply(
            `✅ *Status Koneksi*\n\n` +
            `🔗 WhatsApp terhubung dengan akun Monly AI\n` +
            `📱 Nomor: ${whatsappNumber}\n` +
            `🤖 Bot aktif dan siap mencatat transaksi\n\n` +
            `Kirim "bantuan" untuk melihat cara penggunaan.`
          );
          return;
        }
        
        // Check if it's a budget command
        if (messageText.includes('budget') || 
            messageText.includes('set budget') || 
            messageText.includes('atur budget') ||
            messageText.includes('cek budget') ||
            messageText.includes('hapus budget') ||
            messageText.includes('daftar budget') ||
            messageText.includes('list budget')) {
          await processBudgetCommand(message, messageUserId);
          return;
        }
        
        // Process as transaction text
        await processTextMessage(message, messageUserId);
      }
      
      // Handle voice messages
      else if (message.type === 'ptt' || message.type === 'audio') {
        await message.reply('🎤 Memproses pesan suara...');
        await processVoiceMessage(message, messageUserId);
      }
      
      // Handle image messages (receipts)
      else if (message.type === 'image') {
        await message.reply('📸 Memproses gambar struk...');
        await processImageMessage(message, messageUserId);
      }
      
      // Handle unsupported message types
      else {
        await message.reply(
          `🤖 *Jenis Pesan Tidak Didukung*\n\n` +
          `Saya dapat memproses:\n` +
          `• 📝 Pesan teks (untuk transaksi)\n` +
          `• 🎤 Pesan suara (untuk transaksi)\n` +
          `• 📸 Foto struk/nota\n\n` +
          `Kirim "bantuan" untuk panduan lengkap.`
        );
      }
      
    } catch (error) {
      console.error('Error processing WhatsApp message:', error);
      await message.reply(
        `❌ *Terjadi Kesalahan*\n\n` +
        `Maaf, terjadi kesalahan dalam memproses pesan Anda. Silakan coba lagi nanti atau hubungi support.`
      );
    }
  });

  return true;
};

// Helper function to handle activation code
const handleActivationCode = async (message: any, code: string, whatsappNumber: string) => {
  try {
    // Import needed modules
    const { db } = await import('./db');
    const { whatsappActivationCodes, whatsappIntegrations } = await import('@shared/schema');
    const { eq, and, gt, isNull } = await import('drizzle-orm');
    
    console.log(`Processing activation code: ${code} for WhatsApp: ${whatsappNumber}`);
    
    // Check if activation code exists and is still valid
    const currentTime = Date.now();
    const activationCode = await db.select()
      .from(whatsappActivationCodes)
      .where(
        and(
          eq(whatsappActivationCodes.code, code),
          gt(whatsappActivationCodes.expiresAt, currentTime),
          isNull(whatsappActivationCodes.usedAt)
        )
      )
      .limit(1);

    if (activationCode.length === 0) {
      await message.reply('❌ Kode aktivasi tidak valid atau sudah kadaluarsa.');
      return;
    }

    const codeData = activationCode[0];

    // Check if this WhatsApp number is already connected
    const existingConnection = await db.select()
      .from(whatsappIntegrations)
      .where(eq(whatsappIntegrations.whatsappNumber, whatsappNumber))
      .limit(1);

    if (existingConnection.length > 0) {
      await message.reply('❌ Nomor WhatsApp ini sudah terhubung ke akun lain.');
      return;
    }

    // Create new WhatsApp integration
    await db.insert(whatsappIntegrations).values({
      userId: codeData.userId,
      whatsappNumber,
      displayName: message._data.notifyName || null,
      status: 'active',
      activatedAt: Date.now(),
    });

    // Mark activation code as used
    await db.update(whatsappActivationCodes)
      .set({ usedAt: Date.now() })
      .where(eq(whatsappActivationCodes.id, codeData.id));

    await message.reply(
      `✅ *Akun WhatsApp Berhasil Terhubung!*\n\n` +
      `🎉 Selamat! WhatsApp Anda telah terhubung ke Monly AI.\n\n` +
      `🤖 *Fitur yang Tersedia:*\n` +
      `• 📝 Catat transaksi via teks\n` +
      `• 🎤 Catat transaksi via suara\n` +
      `• 📸 Scan struk/nota otomatis\n` +
      `• 📊 Cek ringkasan keuangan\n\n` +
      `💡 Ketik "bantuan" untuk panduan lengkap atau langsung mulai dengan mengirim transaksi seperti:\n` +
      `"Makan siang 50000"`
    );
    
    console.log(`WhatsApp ${whatsappNumber} successfully activated for user ${codeData.userId}`);
    
  } catch (error) {
    console.error('Error processing activation:', error);
    await message.reply('❌ Terjadi kesalahan saat memproses aktivasi. Silakan coba lagi.');
  }
};

// Helper function to get user ID from WhatsApp number
const getUserIdFromWhatsApp = async (whatsappNumber: string): Promise<string | null> => {
  try {
    const { db } = await import('./db');
    const { whatsappIntegrations } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const connection = await db.select()
      .from(whatsappIntegrations)
      .where(eq(whatsappIntegrations.whatsappNumber, whatsappNumber))
      .limit(1);
      
    return connection.length > 0 ? connection[0].userId : null;
  } catch (error) {
    console.error('Error getting user ID from WhatsApp:', error);
    return null;
  }
};

// Helper function to get user preferences
const getUserPreferences = async (userId: string) => {
  try {
    return await storage.getUserPreferences(userId);
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return null;
  }
};

// Helper function to get user categories
const getUserCategories = async (userId: string) => {
  try {
    return await storage.getCategories(userId);
  } catch (error) {
    console.error('Error getting user categories:', error);
    return [];
  }
};

// Helper function to create transaction
const createTransactionFromAnalysis = async (
  userId: string,
  analysis: any,
  userPreferences: any,
  categories: any[]
) => {
  try {
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
          userId: userId,
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
    
    if (matchingCategory && analysis.amount > 0) {
      const { insertTransactionSchema } = await import('@shared/schema');
      
      const validatedData = insertTransactionSchema.parse({
        userId: userId,
        categoryId: matchingCategory.id,
        amount: parseFloat(analysis.amount.toString()),
        currency: userPreferences?.defaultCurrency || "USD",
        description: analysis.description,
        type: analysis.type,
        date: analysis.date || Math.floor(Date.now() / 1000), // Use parsed date or current timestamp
        aiGenerated: true,
      });

      const transaction = await storage.createTransaction(validatedData);
      console.log('Transaction created from WhatsApp:', transaction);
      
      // Check for budget alerts after creating expense transaction
      let budgetAlert = null;
      let budgetRecommendation = null;
      
      if (analysis.type === 'expense') {
        // First check if category has existing budget
        const existingBudget = await storage.getBudgetByCategory(userId, matchingCategory.id);
        console.log(`Budget check for category ${matchingCategory.name} (ID: ${matchingCategory.id}):`, existingBudget ? 'EXISTS' : 'NOT FOUND');
        
        if (!existingBudget) {
          // No budget exists for this category - generate AI recommendation
          console.log(`No budget found for category ${matchingCategory.name}, generating AI recommendation...`);
          
          try {
            // Get recent transactions for financial profile analysis
            const transactions = await storage.getTransactions(userId);
            console.log(`Retrieved ${transactions.length} transactions for financial analysis`);
            
            // Get financial profile
            const financialProfile = await analyzeFinancialProfile(userId, transactions, userPreferences);
            console.log('Financial profile generated:', financialProfile);
            
            // Generate budget recommendation for this specific category
            const recommendations = await generateBudgetRecommendations(
              userId, 
              financialProfile, 
              categories,
              matchingCategory.name,
              userPreferences,
              transactions  // Pass raw transactions for detailed analysis
            );
            console.log('Budget recommendations received:', recommendations);
            
            if (recommendations && recommendations.length > 0) {
              const categoryBudget = recommendations[0];
              budgetRecommendation = {
                category: matchingCategory.name,
                suggestedAmount: categoryBudget.recommendedAmount,
                reasoning: categoryBudget.reasoning,
                riskLevel: 'medium', // Default risk level
                recommendation: recommendations
              };
              
              console.log('Budget recommendation generated:', budgetRecommendation);
            } else {
              console.log('No budget recommendations generated');
            }
          } catch (error) {
            console.error('Error generating budget recommendation:', error);
          }
        } else {
          // Check for budget alerts on existing budget
          budgetAlert = await checkBudgetAlerts(userId, matchingCategory.id, userPreferences);
        }
      }
      
      return {
        success: true,
        transaction,
        analysis,
        budgetAlert,
        budgetRecommendation
      };
    }
    
    return {
      success: false,
      message: 'Tidak dapat menemukan kategori yang sesuai atau jumlah tidak valid'
    };
    
  } catch (error) {
    console.error('Error creating transaction:', error);
    return {
      success: false,
      message: 'Gagal menyimpan transaksi'
    };
  }
};

// Helper function to format currency
const formatCurrency = (amount: number, currency: string = 'USD') => {
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
  
  const symbol = symbols[currency] || currency;
  const formatter = new Intl.NumberFormat('id-ID');
  
  return `${symbol}${formatter.format(amount)}`;
};

// Helper function to process text message
const processTextMessage = async (message: any, userId: string) => {
  try {
    const userPreferences = await getUserPreferences(userId);
    const categories = await getUserCategories(userId);
    
    // Create preferences object for AI analysis
    const aiPreferences = {
      defaultCurrency: userPreferences?.defaultCurrency || 'USD',
      language: userPreferences?.language || 'id',
      autoCategorize: userPreferences?.autoCategorize || false
    };
    
    console.log(`Analyzing text message for user ${userId}: ${message.body}`);
    
    // Analyze the message with AI
    const analysis = await analyzeTransactionText(message.body, categories, aiPreferences);
    console.log('WhatsApp text analysis result:', analysis);
    
    if (analysis.confidence > 0.7) {
      const result = await createTransactionFromAnalysis(userId, analysis, userPreferences, categories);
      
      if (result.success) {
        const formattedAmount = formatCurrency(analysis.amount, userPreferences?.defaultCurrency);
        
        // Format date if transaction is not for today
        let dateInfo = '';
        if (analysis.date && analysis.date !== Math.floor(Date.now() / 1000)) {
          const transactionDate = new Date(analysis.date * 1000);
          const today = new Date();
          
          // Check if it's today
          const isToday = transactionDate.toDateString() === today.toDateString();
          
          if (!isToday) {
            const options: Intl.DateTimeFormatOptions = { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              timeZone: 'Asia/Jakarta'
            };
            dateInfo = `📅 Tanggal: ${transactionDate.toLocaleDateString('id-ID', options)}\n`;
          }
        }
        
        let replyMessage = `✅ *Transaksi Berhasil Dicatat!*\n\n` +
          `💰 Jumlah: ${formattedAmount}\n` +
          `📝 Deskripsi: ${analysis.description}\n` +
          `📂 Kategori: ${analysis.category}\n` +
          `📊 Jenis: ${analysis.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}\n` +
          dateInfo +
          `🎯 Tingkat Kepercayaan: ${Math.round(analysis.confidence * 100)}%\n\n` +
          `_Transaksi telah disimpan dalam akun Anda_`;
        
        // Add budget alert if exists
        if (result.budgetAlert) {
          replyMessage += `\n\n` + result.budgetAlert.message;
        }
        
        // Add budget recommendation if no budget exists for this category
        if (result.budgetRecommendation) {
          const rec = result.budgetRecommendation;
          const formattedBudget = formatCurrency(rec.suggestedAmount, userPreferences?.defaultCurrency);
          
          replyMessage += `\n\n💡 *Rekomendasi Budget AI*\n\n` +
            `📂 Kategori: ${rec.category}\n` +
            `💰 Budget Disarankan: ${formattedBudget}/bulan\n` +
            `🤖 Alasan: ${rec.reasoning}\n` +
            `⚠️ Tingkat Risiko: ${rec.riskLevel === 'low' ? 'Rendah 🟢' : rec.riskLevel === 'medium' ? 'Sedang 🟡' : 'Tinggi 🔴'}\n\n` +
            `Ingin mengatur budget ini? Ketik:\n` +
            `*"set budget ${rec.category} ${rec.suggestedAmount}"*`;
        }
        
        await message.reply(replyMessage);
      } else {
        await message.reply(
          `❌ *Gagal Mencatat Transaksi*\n\n` +
          `${result.message}\n\n` +
          `Silakan coba lagi atau hubungi support.`
        );
      }
    } else {
      await message.reply(
        `🤔 *Pesan Tidak Dipahami*\n\n` +
        `Maaf, saya tidak dapat memahami pesan Anda sebagai transaksi keuangan.\n\n` +
        `Contoh format yang bisa dipahami:\n` +
        `• "Makan siang di McD 75000"\n` +
        `• "Kemarin beli bensin 50000"\n` +
        `• "Tanggal 15 Juli gaji bulan ini 5000000"\n` +
        `• "2 hari lalu transfer dari ayah 200000"\n` +
        `• "Minggu lalu beli groceries 150000"\n\n` +
        `💡 *Tips tanggal:*\n` +
        `• Gunakan kata seperti "kemarin", "2 hari lalu", "minggu lalu"\n` +
        `• Atau sebutkan tanggal spesifik "15 Juli", "1 Agustus"\n\n` +
        `Atau ketik *"bantuan"* untuk melihat daftar perintah.`
      );
    }
    
  } catch (error) {
    console.error('Error processing text message:', error);
    await message.reply(
      `❌ *Terjadi Kesalahan*\n\n` +
      `Maaf, terjadi kesalahan dalam memproses pesan Anda. Silakan coba lagi nanti.`
    );
  }
};

// Helper function to process voice message
const processVoiceMessage = async (message: any, userId: string) => {
  try {
    console.log('Processing voice message from WhatsApp...');
    
    const userPreferences = await getUserPreferences(userId);
    const categories = await getUserCategories(userId);
    
    // Download the audio
    const media = await message.downloadMedia();
    
    if (!media?.data) {
      await message.reply(
        `❌ *Gagal Memproses Audio*\n\n` +
        `Tidak dapat mengunduh file audio. Silakan coba kirim ulang.`
      );
      return;
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(media.data, 'base64');
    
    // Create a file-like object for OpenAI Whisper
    const audioFile = new File([audioBuffer], 'audio.ogg', { 
      type: media.mimetype || 'audio/ogg' 
    });

    console.log('Transcribing audio with OpenAI Whisper...');
    
    // Use OpenAI Whisper for speech-to-text
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: userPreferences?.language || 'id',
      response_format: 'text',
      temperature: 0.2,
    });

    const transcribedText = transcription.trim();
    console.log('Transcribed text:', transcribedText);

    if (!transcribedText || transcribedText.length === 0) {
      await message.reply(
        `🎤 *Tidak Dapat Mendengar*\n\n` +
        `Saya tidak dapat mendengar dengan jelas. Silakan coba berbicara lebih jelas atau kirim pesan teks.`
      );
      return;
    }
    
    // Create preferences object for AI analysis
    const aiPreferences = {
      defaultCurrency: userPreferences?.defaultCurrency || 'USD',
      language: userPreferences?.language || 'id',
      autoCategorize: userPreferences?.autoCategorize || false
    };
    
    // Analyze the transcribed text
    const analysis = await analyzeTransactionText(transcribedText, categories, aiPreferences);
    console.log('Voice analysis result:', analysis);

    if (analysis.confidence > 0.6) {
      const result = await createTransactionFromAnalysis(userId, analysis, userPreferences, categories);
      
      if (result.success) {
        const formattedAmount = formatCurrency(analysis.amount, userPreferences?.defaultCurrency);
        
        // Format date if transaction is not for today
        let dateInfo = '';
        if (analysis.date && analysis.date !== Math.floor(Date.now() / 1000)) {
          const transactionDate = new Date(analysis.date * 1000);
          const today = new Date();
          
          // Check if it's today
          const isToday = transactionDate.toDateString() === today.toDateString();
          
          if (!isToday) {
            const options: Intl.DateTimeFormatOptions = { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              timeZone: 'Asia/Jakarta'
            };
            dateInfo = `📅 Tanggal: ${transactionDate.toLocaleDateString('id-ID', options)}\n`;
          }
        }
        
        let replyMessage = `🎤 *Pesan Suara Berhasil Diproses!*\n\n` +
          `📝 Saya dengar: "${transcribedText}"\n\n` +
          `✅ *Transaksi Dicatat:*\n` +
          `💰 Jumlah: ${formattedAmount}\n` +
          `📝 Deskripsi: ${analysis.description}\n` +
          `📂 Kategori: ${analysis.category}\n` +
          `📊 Jenis: ${analysis.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}\n` +
          dateInfo +
          `🎯 Tingkat Kepercayaan: ${Math.round(analysis.confidence * 100)}%`;
        
        // Add budget alert if exists
        if (result.budgetAlert) {
          replyMessage += `\n\n` + result.budgetAlert.message;
        }
        
        // Add budget recommendation if no budget exists for this category
        if (result.budgetRecommendation) {
          const rec = result.budgetRecommendation;
          const formattedBudget = formatCurrency(rec.suggestedAmount, userPreferences?.defaultCurrency);
          
          replyMessage += `\n\n💡 *Rekomendasi Budget AI*\n\n` +
            `📂 Kategori: ${rec.category}\n` +
            `💰 Budget Disarankan: ${formattedBudget}/bulan\n` +
            `🤖 Alasan: ${rec.reasoning}\n` +
            `⚠️ Tingkat Risiko: ${rec.riskLevel === 'low' ? 'Rendah 🟢' : rec.riskLevel === 'medium' ? 'Sedang 🟡' : 'Tinggi 🔴'}\n\n` +
            `Ingin mengatur budget ini? Ketik:\n` +
            `*"set budget ${rec.category} ${rec.suggestedAmount}"*`;
        }
        
        await message.reply(replyMessage);
      } else {
        await message.reply(
          `🎤 *Pesan Suara Diproses, Tapi...*\n\n` +
          `📝 Saya dengar: "${transcribedText}"\n\n` +
          `❌ Gagal mencatat transaksi: ${result.message}`
        );
      }
    } else {
      await message.reply(
        `🎤 *Pesan Suara Tidak Dipahami*\n\n` +
        `📝 Saya dengar: "${transcribedText}"\n\n` +
        `🤔 Maaf, saya tidak dapat memahami ini sebagai transaksi keuangan.\n\n` +
        `Coba ucapkan seperti:\n` +
        `• "Makan siang di McD tujuh puluh lima ribu"\n` +
        `• "Beli bensin lima puluh ribu"\n` +
        `• "Gaji bulan ini lima juta"`
      );
    }
    
  } catch (error) {
    console.error('Error processing voice message:', error);
    await message.reply(
      `❌ *Gagal Memproses Pesan Suara*\n\n` +
      `Terjadi kesalahan dalam memproses pesan suara Anda. Silakan coba lagi atau kirim pesan teks.`
    );
  }
};

// Helper function to process image message
const processImageMessage = async (message: any, userId: string) => {
  try {
    console.log('Processing image message from WhatsApp...');
    
    const userPreferences = await getUserPreferences(userId);
    const categories = await getUserCategories(userId);
    
    // Download the image
    const media = await message.downloadMedia();
    
    if (!media?.data) {
      await message.reply(
        `❌ *Gagal Memproses Gambar*\n\n` +
        `Tidak dapat mengunduh gambar. Silakan coba kirim ulang.`
      );
      return;
    }
    
    // Validate image type
    if (!media.mimetype?.startsWith('image/')) {
      await message.reply(
        `❌ *Format File Tidak Didukung*\n\n` +
        `Silakan kirim file gambar (JPG, PNG, dll) yang berisi struk atau nota.`
      );
      return;
    }
    
    console.log('Processing receipt image with OpenAI Vision...');
    
    // Create preferences object for AI analysis
    const aiPreferences = {
      defaultCurrency: userPreferences?.defaultCurrency || 'USD',
      language: userPreferences?.language || 'id',
      autoCategorize: userPreferences?.autoCategorize || false
    };
    
    // Process the image with AI
    const result = await processReceiptImage(media.data, categories, aiPreferences);
    console.log('Image analysis result:', result);
    
    if (result.confidence > 0.6 && result.transactions.length > 0) {
      let successCount = 0;
      let responses: string[] = [];
      let budgetRecommendations: any[] = [];
      
      for (const transaction of result.transactions) {
        const transactionResult = await createTransactionFromAnalysis(
          userId, 
          transaction, 
          userPreferences, 
          categories
        );
        
        if (transactionResult.success) {
          successCount++;
          const formattedAmount = formatCurrency(transaction.amount, userPreferences?.defaultCurrency);
          
          // Format date if transaction is not for today
          let dateInfo = '';
          if (transaction.date && transaction.date !== Math.floor(Date.now() / 1000)) {
            const transactionDate = new Date(transaction.date * 1000);
            const today = new Date();
            
            // Check if it's today
            const isToday = transactionDate.toDateString() === today.toDateString();
            
            if (!isToday) {
              const options: Intl.DateTimeFormatOptions = { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Jakarta'
              };
              dateInfo = ` (${transactionDate.toLocaleDateString('id-ID', options)})`;
            }
          }
          
          responses.push(
            `✅ ${transaction.description}${dateInfo}\n` +
            `💰 ${formattedAmount} (${transaction.category})`
          );
          
          // Collect budget recommendations
          if (transactionResult.budgetRecommendation) {
            budgetRecommendations.push(transactionResult.budgetRecommendation);
          }
        }
      }
      
      if (successCount > 0) {
        let replyMessage = `📸 *Struk Berhasil Diproses!*\n\n` +
          `📝 Teks yang ditemukan:\n"${result.text}"\n\n` +
          `✅ *${successCount} Transaksi Dicatat:*\n\n` +
          responses.join('\n\n') +
          `\n\n🎯 Tingkat Kepercayaan: ${Math.round(result.confidence * 100)}%`;
        
        // Add budget recommendations if any
        if (budgetRecommendations.length > 0) {
          replyMessage += `\n\n💡 *Rekomendasi Budget AI*\n\n`;
          
          budgetRecommendations.forEach((rec, index) => {
            const formattedBudget = formatCurrency(rec.suggestedAmount, userPreferences?.defaultCurrency);
            
            replyMessage += `${index + 1}. 📂 ${rec.category}\n` +
              `💰 Budget Disarankan: ${formattedBudget}/bulan\n` +
              `🤖 Alasan: ${rec.reasoning}\n` +
              `⚠️ Tingkat Risiko: ${rec.riskLevel === 'low' ? 'Rendah 🟢' : rec.riskLevel === 'medium' ? 'Sedang 🟡' : 'Tinggi 🔴'}\n\n`;
          });
          
          replyMessage += `Ingin mengatur budget? Ketik:\n*"set budget [kategori] [jumlah]"*`;
        }
        
        await message.reply(replyMessage);
      } else {
        await message.reply(
          `📸 *Struk Diproses, Tapi...*\n\n` +
          `📝 Teks yang ditemukan:\n"${result.text}"\n\n` +
          `❌ Tidak ada transaksi yang berhasil dicatat. Silakan periksa gambar atau coba lagi.`
        );
      }
    } else {
      await message.reply(
        `📸 *Gambar Tidak Dapat Diproses*\n\n` +
        `🤔 Maaf, saya tidak dapat menemukan informasi transaksi yang jelas dalam gambar ini.\n\n` +
        `💡 *Tips untuk hasil terbaik:*\n` +
        `• Pastikan struk/nota terlihat jelas\n` +
        `• Hindari bayangan atau pantulan\n` +
        `• Pastikan teks dapat dibaca\n` +
        `• Foto dari jarak yang tepat\n\n` +
        `Atau coba kirim detail transaksi via teks/suara.`
      );
    }
    
  } catch (error) {
    console.error('Error processing image message:', error);
    await message.reply(
      `❌ *Gagal Memproses Gambar*\n\n` +
      `Terjadi kesalahan dalam memproses gambar Anda. Silakan coba lagi atau kirim detail transaksi via teks.`
    );
  }
};

// Helper function to show help message
const showHelpMessage = async (message: any) => {
  await message.reply(
    `🤖 *Monly AI - Asisten Keuangan WhatsApp*\n\n` +
    `📝 *Cara Mencatat Transaksi:*\n\n` +
    `1️⃣ *Pesan Teks:*\n` +
    `• "Makan siang di McD 75000"\n` +
    `• "Beli bensin 50000"\n` +
    `• "Gaji bulan ini 5000000"\n` +
    `• "Transfer dari ayah 200000"\n\n` +
    `• "Kemarin beli bensin 50000"\n` +
    `• "Tanggal 15 Juli gaji 5000000"\n` +
    `• "2 hari lalu transfer dari ayah 200000"\n\n` +
    `2️⃣ *Pesan Suara:*\n` +
    `Tekan dan tahan tombol mikrofon, lalu ucapkan transaksi Anda\n\n` +
    `3️⃣ *Kirim Foto:*\n` +
    `Foto struk/nota belanja untuk pencatatan otomatis\n\n` +
    `💰 *Manajemen Budget:*\n` +
    `• "set budget makan 500000 per bulan"\n` +
    `• "atur budget transport 200rb mingguan"\n` +
    `• "cek budget saya"\n` +
    `• "daftar budget"\n` +
    `• "hapus budget [kategori]"\n\n` +
    `📱 *Perintah Lain:*\n` +
    `• ketik "bantuan" - Lihat pesan ini\n` +
    `• ketik "saldo" - Cek ringkasan keuangan\n` +
    `• ketik "status" - Status koneksi akun\n\n` +
    `💡 *Tips:* Semakin jelas informasi yang Anda berikan, semakin akurat pencatatan transaksi!`
  );
};

// Helper function to show balance/summary
const showBalanceSummary = async (message: any, userId: string) => {
  try {
    // Get recent transactions and summary
    const transactions = await storage.getTransactions(userId);
    const userPreferences = await getUserPreferences(userId);
    
    if (!transactions || transactions.length === 0) {
      await message.reply(
        `📊 *Ringkasan Keuangan*\n\n` +
        `Belum ada transaksi yang tercatat.\n\n` +
        `Mulai catat transaksi Anda dengan mengirim pesan seperti:\n` +
        `"Makan siang 50000" atau foto struk belanja.`
      );
      return;
    }
    
    // Calculate totals for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTransactions = transactions.filter(t => 
      new Date(t.date * 1000) >= startOfMonth
    );
    
    const monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const monthlyExpense = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = monthlyIncome - monthlyExpense;
    const currency = userPreferences?.defaultCurrency || 'USD';
    
    // Format recent transactions
    const recentList = transactions.slice(0, 3).map(t => {
      const amount = formatCurrency(t.amount, currency);
      const type = t.type === 'expense' ? '📤' : '📥';
      return `${type} ${amount} - ${t.description}`;
    }).join('\n');
    
    await message.reply(
      `📊 *Ringkasan Keuangan (${now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })})*\n\n` +
      `📥 *Pemasukan:* ${formatCurrency(monthlyIncome, currency)}\n` +
      `📤 *Pengeluaran:* ${formatCurrency(monthlyExpense, currency)}\n` +
      `💰 *Saldo:* ${formatCurrency(balance, currency)}\n\n` +
      `📋 *Transaksi Terbaru:*\n${recentList}\n\n` +
      `_Akses dashboard lengkap di aplikasi Monly AI_`
    );
    
  } catch (error) {
    console.error('Error showing balance summary:', error);
    await message.reply(
      `❌ *Gagal Mengambil Data*\n\n` +
      `Terjadi kesalahan saat mengambil ringkasan keuangan. Silakan coba lagi nanti.`
    );
  }
};

// Helper function to process budget commands
const processBudgetCommand = async (message: any, userId: string) => {
  try {
    const userPreferences = await getUserPreferences(userId);
    const categories = await getUserCategories(userId);
    
    // Create preferences object for AI analysis
    const aiPreferences = {
      defaultCurrency: userPreferences?.defaultCurrency || 'USD',
      language: userPreferences?.language || 'id',
      autoCategorize: userPreferences?.autoCategorize || false
    };
    
    console.log(`Analyzing budget command for user ${userId}: ${message.body}`);
    
    // Import budget analysis function
    const { analyzeBudgetCommand } = await import('./openai');
    
    // Analyze the budget command with AI
    const analysis = await analyzeBudgetCommand(message.body, categories, aiPreferences);
    console.log('Budget command analysis result:', analysis);
    
    if (analysis.confidence > 0.7) {
      const result = await handleBudgetAction(userId, analysis, userPreferences, categories);
      
      if (result.success) {
        await message.reply(result.message);
      } else {
        await message.reply(
          `❌ *Gagal Mengelola Budget*\n\n` +
          `${result.message}\n\n` +
          `Silakan coba lagi atau hubungi support.`
        );
      }
    } else {
      await message.reply(
        `🤔 *Perintah Budget Tidak Dipahami*\n\n` +
        `Maaf, saya tidak dapat memahami perintah budget Anda.\n\n` +
        `Contoh perintah yang bisa dipahami:\n` +
        `• "set budget makan 500000 per bulan"\n` +
        `• "atur budget transport 200rb mingguan"\n` +
        `• "cek budget saya"\n` +
        `• "hapus budget entertainment"\n` +
        `• "daftar semua budget"\n\n` +
        `Atau ketik *"bantuan budget"* untuk panduan lengkap.`
      );
    }
    
  } catch (error) {
    console.error('Error processing budget command:', error);
    await message.reply(
      `❌ *Terjadi Kesalahan*\n\n` +
      `Maaf, terjadi kesalahan dalam memproses perintah budget Anda. Silakan coba lagi nanti.`
    );
  }
};

// Helper function to handle budget actions
const handleBudgetAction = async (
  userId: string,
  analysis: any,
  userPreferences: any,
  categories: any[]
) => {
  try {
    const { storage } = await import('./storage');
    
    switch (analysis.action) {
      case 'create':
      case 'update':
        if (!analysis.category || !analysis.amount) {
          return {
            success: false,
            message: 'Kategori dan jumlah budget harus disebutkan'
          };
        }
        
        // Find matching category
        let matchingCategory = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        if (!matchingCategory) {
          return {
            success: false,
            message: `Kategori "${analysis.category}" tidak ditemukan. Gunakan kategori yang tersedia atau buat kategori baru terlebih dahulu.`
          };
        }
        
        // Create or update budget
        const budgetData = {
          userId: userId,
          categoryId: matchingCategory.id,
          amount: analysis.amount,
          period: analysis.period || 'monthly',
          spent: 0,
          startDate: Math.floor(Date.now() / 1000),
          endDate: Math.floor(Date.now() / 1000) + (analysis.period === 'weekly' ? 7 * 24 * 60 * 60 : 30 * 24 * 60 * 60)
        };
        
        const budget = await storage.createOrUpdateBudget(budgetData);
        const formattedAmount = formatCurrency(analysis.amount, userPreferences?.defaultCurrency);
        
        return {
          success: true,
          message: `✅ *Budget ${analysis.action === 'create' ? 'Dibuat' : 'Diperbarui'}!*\n\n` +
                  `📂 Kategori: ${matchingCategory.name}\n` +
                  `💰 Jumlah: ${formattedAmount}\n` +
                  `📅 Periode: ${analysis.period === 'weekly' ? 'Mingguan' : 'Bulanan'}\n\n` +
                  `_Budget telah disimpan dan akan dipantau secara otomatis_`
        };
        
      case 'delete':
        if (!analysis.category) {
          return {
            success: false,
            message: 'Kategori budget yang akan dihapus harus disebutkan'
          };
        }
        
        // Find matching category
        const categoryToDelete = categories.find(c => 
          c.name.toLowerCase() === analysis.category.toLowerCase()
        );
        
        if (!categoryToDelete) {
          return {
            success: false,
            message: `Kategori "${analysis.category}" tidak ditemukan`
          };
        }
        
        await storage.deleteBudget(categoryToDelete.id);
        
        return {
          success: true,
          message: `✅ *Budget Dihapus!*\n\n` +
                  `📂 Kategori: ${categoryToDelete.name}\n\n` +
                  `_Budget untuk kategori ini telah dihapus_`
        };
        
      case 'check':
        const budgetStatus = await getBudgetStatus(userId, userPreferences);
        return {
          success: true,
          message: budgetStatus
        };
        
      case 'list':
        const budgetList = await getBudgetList(userId, userPreferences);
        return {
          success: true,
          message: budgetList
        };
        
      default:
        return {
          success: false,
          message: 'Perintah budget tidak dikenali'
        };
    }
    
  } catch (error) {
    console.error('Error handling budget action:', error);
    return {
      success: false,
      message: 'Gagal mengelola budget'
    };
  }
};

// Helper function to get budget status
const getBudgetStatus = async (userId: string, userPreferences: any) => {
  try {
    const { storage } = await import('./storage');
    const { generateBudgetAlert } = await import('./openai');
    
    const budgets = await storage.getUserBudgets(userId);
    
    if (!budgets || budgets.length === 0) {
      return `📊 *Status Budget*\n\n` +
             `Anda belum memiliki budget yang aktif.\n\n` +
             `Mulai dengan membuat budget:\n` +
             `• "set budget makan 500000 per bulan"\n` +
             `• "atur budget transport 200rb mingguan"`;
    }
    
    let statusMessages = [`📊 *Status Budget Anda*\n`];
    let totalSpent = 0;
    let totalBudget = 0;
    let alerts = [];
    
    for (const budget of budgets) {
      const category = await storage.getCategoryById(budget.categoryId, userId);
      if (!category) continue;
      
      // Calculate spent amount for this period
      const periodStart = budget.startDate;
      const periodEnd = budget.endDate;
      const spent = await storage.getSpentInPeriod(userId, budget.categoryId, periodStart, periodEnd);
      
      totalSpent += spent;
      totalBudget += budget.amount;
      
      // Generate alert for this budget
      const alert = await generateBudgetAlert(
        category.name,
        spent,
        budget.amount,
        userPreferences?.defaultCurrency || 'USD',
        userPreferences?.language || 'id'
      );
      
      const percentage = (spent / budget.amount) * 100;
      const remaining = budget.amount - spent;
      const formattedSpent = formatCurrency(spent, userPreferences?.defaultCurrency);
      const formattedBudget = formatCurrency(budget.amount, userPreferences?.defaultCurrency);
      const formattedRemaining = formatCurrency(remaining, userPreferences?.defaultCurrency);
      
      let statusIcon = '✅';
      if (percentage >= 100) statusIcon = '🚨';
      else if (percentage >= 80) statusIcon = '⚠️';
      else if (percentage >= 60) statusIcon = '💡';
      
      statusMessages.push(
        `${statusIcon} **${category.name}**\n` +
        `   💰 Terpakai: ${formattedSpent} / ${formattedBudget}\n` +
        `   📊 Persentase: ${percentage.toFixed(1)}%\n` +
        `   💳 Sisa: ${formattedRemaining}\n`
      );
      
      // Collect alerts for high usage
      if (percentage >= 60) {
        alerts.push(alert.message);
      }
    }
    
    // Add summary
    const totalFormattedSpent = formatCurrency(totalSpent, userPreferences?.defaultCurrency);
    const totalFormattedBudget = formatCurrency(totalBudget, userPreferences?.defaultCurrency);
    const overallPercentage = (totalSpent / totalBudget) * 100;
    
    statusMessages.push(
      `\n📈 **Ringkasan Total:**\n` +
      `💰 Total Terpakai: ${totalFormattedSpent}\n` +
      `🎯 Total Budget: ${totalFormattedBudget}\n` +
      `📊 Persentase Keseluruhan: ${overallPercentage.toFixed(1)}%`
    );
    
    // Add alerts if any
    if (alerts.length > 0) {
      statusMessages.push(`\n🔔 **Peringatan:**`);
      alerts.forEach(alert => statusMessages.push(`• ${alert}`));
    }
    
    return statusMessages.join('\n');
    
  } catch (error) {
    console.error('Error getting budget status:', error);
    return `❌ Gagal mengambil status budget`;
  }
};

// Helper function to get budget list
const getBudgetList = async (userId: string, userPreferences: any) => {
  try {
    const { storage } = await import('./storage');
    
    const budgets = await storage.getUserBudgets(userId);
    
    if (!budgets || budgets.length === 0) {
      return `📋 *Daftar Budget*\n\n` +
             `Anda belum memiliki budget yang aktif.\n\n` +
             `Mulai dengan membuat budget:\n` +
             `• "set budget makan 500000 per bulan"\n` +
             `• "atur budget transport 200rb mingguan"`;
    }
    
    let listMessages = [`📋 *Daftar Budget Anda*\n`];
    
    for (const budget of budgets) {
      const category = await storage.getCategoryById(budget.categoryId, userId);
      if (!category) continue;
      
      const formattedAmount = formatCurrency(budget.amount, userPreferences?.defaultCurrency);
      const periodText = budget.period === 'weekly' ? 'Mingguan' : 'Bulanan';
      
      listMessages.push(
        `📂 **${category.name}**\n` +
        `   💰 Budget: ${formattedAmount}\n` +
        `   📅 Periode: ${periodText}\n`
      );
    }
    
    listMessages.push(
      `\n💡 *Tips:*\n` +
      `• Ketik "cek budget" untuk melihat status\n` +
      `• Ketik "hapus budget [kategori]" untuk menghapus\n` +
      `• Ketik "set budget [kategori] [jumlah]" untuk mengubah`
    );
    
    return listMessages.join('\n');
    
  } catch (error) {
    console.error('Error getting budget list:', error);
    return `❌ Gagal mengambil daftar budget`;
  }
};

// Helper function to check budget alerts after transaction
const checkBudgetAlerts = async (userId: string, categoryId: number, userPreferences: any) => {
  try {
    const { storage } = await import('./storage');
    const { generateBudgetAlert } = await import('./openai');
    
    // Get active budget for this category
    const budget = await storage.getBudgetByCategory(userId, categoryId);
    if (!budget) return null;
    
    // Get category info
    const category = await storage.getCategoryById(categoryId, userId);
    if (!category) return null;
    
    // Calculate spent amount for current period
    const spent = await storage.getSpentInPeriod(userId, categoryId, budget.startDate, budget.endDate);
    
    // Generate alert
    const alert = await generateBudgetAlert(
      category.name,
      spent,
      budget.amount,
      userPreferences?.defaultCurrency || 'USD',
      userPreferences?.language || 'id'
    );
    
    // Only return alert if it's warning level or above
    if (alert.percentage >= 60) {
      return alert;
    }
    
    return null;
    
  } catch (error) {
    console.error('Error checking budget alerts:', error);
    return null;
  }
};
