import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import { db } from './db';
import { transactions, categories } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeTransactionText, processReceiptImage, UserPreferences } from './openai';

// Helper function to get user preferences
async function getUserPreferences(userId: string): Promise<UserPreferences> {
  return {
    defaultCurrency: 'IDR',
    language: 'id',
    autoCategorize: true
  };
}

// Helper function to get category ID by name and type
async function getCategoryId(categoryName: string, type: 'income' | 'expense', userId: string): Promise<number | null> {
  try {
    const category = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.name, categoryName),
          eq(categories.type, type),
          eq(categories.userId, userId)
        )
      )
      .limit(1);

    if (category.length > 0) {
      return category[0].id;
    }

    // If not found, create a new category
    const [newCategory] = await db
      .insert(categories)
      .values({
        name: categoryName,
        icon: type === 'income' ? '💰' : '💸',
        color: type === 'income' ? '#10B981' : '#EF4444',
        type: type,
        userId: userId,
        createdAt: Math.floor(Date.now() / 1000)
      })
      .returning();

    return newCategory.id;
  } catch (error) {
    console.error('Error getting/creating category:', error);
    return null;
  }
}

// Helper function to get category name by ID
async function getCategoryName(categoryId: number): Promise<string> {
  try {
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    return category.length > 0 ? category[0].name : 'Unknown';
  } catch (error) {
    console.error('Error getting category name:', error);
    return 'Unknown';
  }
}

// Type definitions for WhatsApp Web.js
type WAClient = InstanceType<typeof Client>;

interface WhatsAppConnection {
  client: WAClient;
  status: 'initializing' | 'loading_screen' | 'qr_received' | 'authenticated' | 'ready' | 'disconnected';
  qrCode: string | null;
  userId: string;
}

// Store WhatsApp connections by user ID
const connections: Map<string, WhatsAppConnection> = new Map();

/**
 * Initialize WhatsApp client for a user
 * @param userId The user ID to associate with the WhatsApp client
 * @returns The WhatsApp connection object
 */
export const initializeWhatsAppClient = (userId: string): WhatsAppConnection => {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: './.wwebjs_auth/'
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  const connection: WhatsAppConnection = {
    client,
    status: 'initializing',
    qrCode: null,
    userId
  };

  connections.set(userId, connection);

  // Setup event handlers
  client.on('loading_screen', (percent, message) => {
    console.log('Loading screen', percent, message);
    connection.status = 'loading_screen';
  });

  client.on('qr', async (qr) => {
    console.log('QR Code received');
    connection.status = 'qr_received';
    try {
      connection.qrCode = await qrcode.toDataURL(qr);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  });

  client.on('authenticated', () => {
    console.log('WhatsApp client authenticated');
    connection.status = 'authenticated';
  });

  client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    connection.status = 'ready';
    registerMessageHandlers(userId);
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    connection.status = 'disconnected';
  });

  return connection;
};

/**
 * Get connection state for a user
 * @param userId The user ID
 * @returns The connection state or null if not found
 */
export const getConnectionState = (userId: string) => {
  const connection = connections.get(userId);
  if (!connection) return null;

  return {
    status: connection.status,
    qrCode: connection.qrCode
  };
};

/**
 * Get WhatsApp connection status
 * @returns Object containing all connection statuses
 */
export const getWhatsAppConnectionStatus = () => {
  const statuses: Record<string, any> = {};
  for (const [userId, connection] of connections) {
    statuses[userId] = {
      status: connection.status,
      qrCode: connection.qrCode
    };
  }
  return statuses;
};

/**
 * Generate QR code for WhatsApp Web authentication
 * @returns Promise with QR code status and data
 */
export const generateQRCode = async (): Promise<{ success: boolean; status: string; qrCode?: string }> => {
  try {
    // For now, we'll use the first available connection or create a new one
    // In production, this should be user-specific
    const defaultUserId = 'default';
    let connection = connections.get(defaultUserId);
    
    if (!connection) {
      connection = initializeWhatsAppClient(defaultUserId);
    }

    // Initialize the client if not already done
    if (connection.status === 'initializing') {
      await connection.client.initialize();
    }

    // Wait for QR code generation (up to 30 seconds)
    const timeout = 30000;
    const startTime = Date.now();
    
    while (connection.status !== 'qr_received' && connection.status !== 'ready' && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (connection.status === 'ready') {
      return {
        success: true,
        status: 'already_authenticated'
      };
    }

    if (connection.status === 'qr_received' && connection.qrCode) {
      return {
        success: true,
        status: 'qr_ready',
        qrCode: connection.qrCode
      };
    }

    return {
      success: false,
      status: 'timeout'
    };
  } catch (error) {
    console.error('Error generating QR code:', error);
    return {
      success: false,
      status: 'error'
    };
  }
};

/**
 * Disconnect WhatsApp client
 * @returns Promise with disconnection status
 */
export const disconnectWhatsApp = async (): Promise<{ success: boolean; message: string }> => {
  try {
    for (const [userId, connection] of connections) {
      if (connection.client) {
        await connection.client.destroy();
      }
      connections.delete(userId);
    }
    
    return {
      success: true,
      message: 'WhatsApp disconnected successfully'
    };
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    return {
      success: false,
      message: 'Failed to disconnect WhatsApp'
    };
  }
};

// Helper function to get user ID from WhatsApp number
const getUserIdFromWhatsApp = async (whatsappNumber: string): Promise<string | null> => {
  try {
    const { whatsappIntegrations } = await import('../shared/schema');
    
    const integration = await db
      .select()
      .from(whatsappIntegrations)
      .where(eq(whatsappIntegrations.whatsappNumber, whatsappNumber))
      .limit(1);

    return integration.length > 0 ? integration[0].userId : null;
  } catch (error) {
    console.error('Error getting user ID from WhatsApp:', error);
    return null;
  }
};

// Enhanced AI transaction processing using openai.ts functions
const processTransactionWithAI = async (message: any, whatsappNumber: string): Promise<void> => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  try {
    // Get user preferences and available categories
    const userPreferences = await getUserPreferences(userId);
    const availableCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    let transactionResult;

    // Handle different message types
    if (message.hasMedia) {
      const media = await message.downloadMedia();
      
      if (media.mimetype?.startsWith('audio/')) {
        // Voice message processing - for now process as text
        await message.reply('🎤 Sedang memproses pesan suara...');
        
        transactionResult = await analyzeTransactionText(
          "Voice message - manual processing needed",
          availableCategories,
          userPreferences
        );
      } else if (media.mimetype?.startsWith('image/')) {
        // Image processing
        await message.reply('📸 Sedang menganalisis gambar...');
        
        const ocrResult = await processReceiptImage(
          media.data,
          availableCategories,
          userPreferences
        );
        
        if (ocrResult.transactions.length > 0) {
          transactionResult = ocrResult.transactions[0];
          await message.reply(`📸 Struk berhasil dianalisis!\n\n📝 Teks: ${ocrResult.text}`);
        } else {
          await message.reply('❌ Tidak dapat menemukan informasi transaksi di gambar ini.');
          return;
        }
      }
    } else {
      // Text message processing
      transactionResult = await analyzeTransactionText(
        message.body,
        availableCategories,
        userPreferences
      );
    }

    if (!transactionResult || transactionResult.confidence < 0.3) {
      await message.reply('❌ Maaf, saya tidak dapat memahami transaksi dari pesan Anda. Coba gunakan format seperti: "Beli makan siang 25000"');
      return;
    }

    // Handle new category suggestion
    let categoryId;
    if (transactionResult.suggestedNewCategory) {
      // Create new category
      const [newCategory] = await db
        .insert(categories)
        .values({
          name: transactionResult.suggestedNewCategory.name,
          icon: transactionResult.suggestedNewCategory.icon,
          color: transactionResult.suggestedNewCategory.color,
          type: transactionResult.suggestedNewCategory.type,
          userId: userId,
          createdAt: Math.floor(Date.now() / 1000)
        })
        .returning();
      categoryId = newCategory.id;
    } else {
      // Find existing category
      categoryId = await getCategoryId(transactionResult.category, transactionResult.type, userId);
    }

    if (!categoryId) {
      throw new Error('Failed to get category ID');
    }

    // Save transaction to database
    const transactionData = {
      userId,
      categoryId,
      amount: Math.abs(transactionResult.amount),
      currency: userPreferences.defaultCurrency,
      description: transactionResult.description,
      type: transactionResult.type,
      date: Math.floor(Date.now() / 1000),
      aiGenerated: true,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000)
    };

    await db.insert(transactions).values(transactionData);

    // Format response
    const typeIcon = transactionResult.type === 'income' ? '💰' : '💸';
    const categoryIcon = transactionResult.suggestedNewCategory?.icon || '📂';
    const formattedAmount = new Intl.NumberFormat('id-ID').format(transactionResult.amount);
    
    let response = `✅ Transaksi berhasil dicatat!\n\n`;
    response += `${typeIcon} ${transactionResult.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}: Rp ${formattedAmount}\n`;
    response += `${categoryIcon} Kategori: ${transactionResult.category}\n`;
    response += `📝 Deskripsi: ${transactionResult.description}\n`;
    response += `🤖 Tingkat kepercayaan AI: ${Math.round(transactionResult.confidence * 100)}%`;

    if (transactionResult.suggestedNewCategory) {
      response += `\n\n🆕 Kategori baru "${transactionResult.suggestedNewCategory.name}" telah dibuat!`;
    }

    await message.reply(response);

  } catch (error) {
    console.error('Error processing AI transaction:', error);
    await message.reply('❌ Terjadi kesalahan saat memproses transaksi. Silakan coba lagi.');
  }
};

// Get user balance and financial summary
const getUserFinancialSummary = async (userId: string) => {
  try {
    // Get all transactions with category names
    const allTransactions = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        description: transactions.description,
        type: transactions.type,
        date: transactions.date,
        categoryId: transactions.categoryId,
        categoryName: categories.name
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId));
    
    // Calculate totals based on type field
    const totalIncome = allTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = allTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const totalBalance = totalIncome - totalExpense;
    
    // Monthly data (current month)
    const currentMonth = new Date();
    const monthStart = Math.floor(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getTime() / 1000);
    
    const monthlyTransactions = allTransactions.filter(t => t.date >= monthStart);
    const monthlyIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpense = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    return {
      totalBalance,
      totalIncome,
      totalExpense,
      monthlyIncome,
      monthlyExpense,
      monthlyTransactions,
      allTransactions
    };
  } catch (error) {
    console.error('Error getting financial summary:', error);
    return null;
  }
};

// Handle balance inquiry
const handleBalanceInquiry = async (message: any, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  try {
    const summary = await getUserFinancialSummary(userId);
    if (!summary) {
      await message.reply('❌ Gagal mengambil data keuangan.');
      return;
    }

    const response = `💰 *RINGKASAN KEUANGAN*\n\n` +
      `💳 Saldo Total: Rp ${summary.totalBalance.toLocaleString('id-ID')}\n\n` +
      `📊 *Bulan Ini:*\n` +
      `💚 Pemasukan: Rp ${summary.monthlyIncome.toLocaleString('id-ID')}\n` +
      `💸 Pengeluaran: Rp ${summary.monthlyExpense.toLocaleString('id-ID')}\n` +
      `📈 Selisih: Rp ${(summary.monthlyIncome - summary.monthlyExpense).toLocaleString('id-ID')}\n\n` +
      `📝 Total Transaksi: ${summary.monthlyTransactions.length}\n` +
      `📅 Diperbarui: ${new Date().toLocaleString('id-ID')}`;

    await message.reply(response);
  } catch (error) {
    console.error('Error getting balance:', error);
    await message.reply('❌ Gagal mengambil data saldo. Silakan coba lagi.');
  }
};

// Handle financial reports
const handleFinancialReports = async (message: any, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  try {
    const summary = await getUserFinancialSummary(userId);
    if (!summary) {
      await message.reply('❌ Gagal mengambil data laporan.');
      return;
    }

    // Get category breakdown
    const categoryBreakdown = summary.monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        const categoryName = t.categoryName || 'Lainnya';
        acc[categoryName] = (acc[categoryName] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    let response = `📊 *LAPORAN KEUANGAN BULANAN*\n\n`;
    response += `💰 Total Income: Rp ${summary.monthlyIncome.toLocaleString('id-ID')}\n`;
    response += `💸 Total Expense: Rp ${summary.monthlyExpense.toLocaleString('id-ID')}\n`;
    response += `💳 Net Balance: Rp ${(summary.monthlyIncome - summary.monthlyExpense).toLocaleString('id-ID')}\n\n`;
    
    response += `📂 *Breakdown per Kategori:*\n`;
    Object.entries(categoryBreakdown)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([category, amount]) => {
        response += `• ${category}: Rp ${amount.toLocaleString('id-ID')}\n`;
      });

    await message.reply(response);
  } catch (error) {
    console.error('Error generating report:', error);
    await message.reply('❌ Gagal membuat laporan. Silakan coba lagi.');
  }
};

// Handle AI insights
const handleAIInsights = async (message: any, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  try {
    const summary = await getUserFinancialSummary(userId);
    if (!summary) {
      await message.reply('❌ Gagal mengambil data untuk analisis.');
      return;
    }

    // Simple AI insights based on data
    let insights = `🧠 *AI FINANCIAL INSIGHTS*\n\n`;
    
    const savingsRate = summary.monthlyIncome > 0 ? ((summary.monthlyIncome - summary.monthlyExpense) / summary.monthlyIncome) * 100 : 0;
    
    if (savingsRate > 20) {
      insights += `🎉 Hebat! Tingkat saving Anda ${savingsRate.toFixed(1)}% sangat baik!\n\n`;
    } else if (savingsRate > 0) {
      insights += `💡 Tingkat saving Anda ${savingsRate.toFixed(1)}%. Coba target 20% untuk keuangan yang lebih sehat.\n\n`;
    } else {
      insights += `⚠️ Pengeluaran melebihi pemasukan. Saatnya review budget!\n\n`;
    }

    insights += `📊 *Rekomendasi:*\n`;
    insights += `• Review pengeluaran terbesar\n`;
    insights += `• Set budget per kategori\n`;
    insights += `• Track spending harian\n`;
    insights += `• Tingkatkan emergency fund\n\n`;
    insights += `💪 Tetap semangat mengelola keuangan!`;

    await message.reply(insights);
  } catch (error) {
    console.error('Error generating AI insights:', error);
    await message.reply('❌ Gagal membuat analisis. Silakan coba lagi.');
  }
};

// Handle help command
const handleHelpCommand = async (message: any) => {
  const helpText = `🤖 *Monly AI - Financial Assistant*

✨ *Fitur AI Terbaru:*
📝 Ketik pesan natural: "Beli nasi gudeg 25000"
🎤 Kirim voice message tentang transaksi
📸 Foto struk/receipt untuk auto-extract

💰 *Perintah Khusus:*
• \`saldo\` - Cek saldo & ringkasan
• \`report\` - Laporan keuangan lengkap  
• \`ai\` - Financial insights & tips
• \`help\` - Menu bantuan ini

🚀 *Cara Kerja AI:*
✅ Deteksi otomatis income/expense
✅ Auto-categorization transaksi
✅ Smart amount recognition
✅ Multi-format support (text/voice/image)
✅ Indonesian language optimized

💡 *Contoh Pesan:*
• "Makan siang di McDonald's 45ribu"
• "Terima gaji bulanan 5 juta"
• "Bayar listrik PLN 150000"
• [Voice] "Tadi beli bensin seratus ribu"
• [Photo] Foto struk belanja

🔥 *Powered by OpenAI GPT-4 & Whisper*`;

  await message.reply(helpText);
};

/**
 * Register message handlers for a user's WhatsApp client
 * @param userId The user ID
 * @returns Boolean indicating success
 */
export const registerMessageHandlers = (userId: string): boolean => {
  const connection = connections.get(userId);
  
  if (!connection || connection.status !== 'ready') {
    return false;
  }

  // Handle incoming messages
  connection.client.on('message', async (message: any) => {
    console.log(`Message received from ${message.from}: ${message.body}`);

    // Extract WhatsApp number
    const whatsappNumber = message.from.replace('@c.us', ''); // Remove WhatsApp suffix

    // Check for activation command: "AKTIVASI: CODE"
    const activationPattern = /^AKTIVASI:\s*([A-Z0-9]{6})$/i;
    const activationMatch = message.body.match(activationPattern);

    if (activationMatch) {
      const code = activationMatch[1].toUpperCase();
      
      try {
        // Call activation API using internal database call
        const { whatsappActivationCodes, whatsappIntegrations } = await import('../shared/schema');
        const { gt, isNull } = await import('drizzle-orm');
        
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

        await message.reply('✅ Akun WhatsApp Anda telah berhasil terhubung ke Monly AI! Ketik "bantuan" untuk melihat daftar perintah.');
        console.log(`WhatsApp ${whatsappNumber} successfully activated for user ${codeData.userId}`);
        
      } catch (error) {
        console.error('Error processing activation:', error);
        await message.reply('❌ Terjadi kesalahan saat memproses aktivasi. Silakan coba lagi.');
      }
    }
    // Special commands
    else if (message.body.match(/^(balance|saldo|total|dana)$/i)) {
      await handleBalanceInquiry(message, whatsappNumber);
    }
    else if (message.body.match(/^(report|laporan|summary|ringkasan)$/i)) {
      await handleFinancialReports(message, whatsappNumber);
    }
    else if (message.body.match(/^(ai|insight|saran|tips|analisa)$/i)) {
      await handleAIInsights(message, whatsappNumber);
    }
    else if (message.body.match(/^(help|bantuan|\?|menu)$/i)) {
      await handleHelpCommand(message);
    }
    // All other messages (text, voice, image) processed with AI
    else {
      await processTransactionWithAI(message, whatsappNumber);
    }
  });

  return true;
};
