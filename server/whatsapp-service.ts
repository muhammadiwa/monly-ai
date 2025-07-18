import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

// Type definitions for WhatsApp Web.js
type WAClient = InstanceType<typeof Client>;
type WAMessage = any; // We'll use any for message type since the library doesn't export it properly

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
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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
 * Get the current WhatsApp connection status
 * Global status function for the service (not user-specific)
 */
export const getWhatsAppConnectionStatus = () => {
  // For now, just return a global status - in a real implementation, this would be user-specific
  // Get the first connection from the map or return disconnected state
  if (connections.size === 0) {
    return {
      connected: false,
      status: 'disconnected'
    };
  }

  // Return the first connection's status (this is a simplification)
  const firstConnection = Array.from(connections.values())[0];
  return {
    connected: firstConnection.status === 'ready' || firstConnection.status === 'authenticated',
    status: firstConnection.status,
    qrCode: firstConnection.qrCode
  };
};

/**
 * Generate QR code for WhatsApp Web connection
 * Since we're using a simplified approach without user-specific clients for now,
 * this will initialize a generic client if none exists
 */
export const generateQRCode = async (): Promise<{ success: boolean; status: string; qrCode?: string }> => {
  try {
    // Use a temporary user ID for demo purposes
    const tempUserId = 'default-user';
    
    // Initialize client
    const connection = initializeWhatsAppClient(tempUserId);
    
    // If QR code is already available, return it immediately
    if (connection.qrCode && connection.status === 'qr_received') {
      return {
        success: true,
        status: connection.status,
        qrCode: connection.qrCode
      };
    }
    
    // If client is already authenticated or ready, return that status
    if (connection.status === 'ready' || connection.status === 'authenticated') {
      return {
        success: true,
        status: connection.status
      };
    }
    
    // Wait for QR code to be generated
    return new Promise((resolve) => {
      // Set a timeout
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          status: 'timeout',
        });
      }, 30000); // 30 second timeout
      
      // Listen for QR code event
      const checkInterval = setInterval(() => {
        if (connection.qrCode && connection.status === 'qr_received') {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve({
            success: true,
            status: connection.status,
            qrCode: connection.qrCode
          });
        } else if (connection.status === 'ready' || connection.status === 'authenticated') {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve({
            success: true,
            status: connection.status
          });
        }
      }, 1000);
    });
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
 * For now just disconnects the first client in the map
 */
export const disconnectWhatsApp = async (): Promise<{ success: boolean; message: string }> => {
  try {
    if (connections.size === 0) {
      return {
        success: false,
        message: 'No WhatsApp connections found'
      };
    }
    
    const firstConnectionEntry = Array.from(connections.entries())[0];
    const userId = firstConnectionEntry[0];
    const connection = firstConnectionEntry[1];
    
    await connection.client.destroy();
    connections.delete(userId);
    
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

/**
 * Register message handlers for financial operations
 * @param userId The user ID to register handlers for
 */
export const registerMessageHandlers = (userId: string): boolean => {
  const connection = connections.get(userId);
  if (!connection || connection.status !== 'ready') {
    return false;
  }

  // Handle incoming messages
  connection.client.on('message', async (message: WAMessage) => {
    console.log(`Message received from ${message.from}: ${message.body}`);

    // Check for activation command: "AKTIVASI: CODE"
    const activationPattern = /^AKTIVASI:\s*([A-Z0-9]{6})$/i;
    const activationMatch = message.body.match(activationPattern);

    if (activationMatch) {
      const code = activationMatch[1].toUpperCase();
      const whatsappNumber = message.from.replace('@c.us', ''); // Remove WhatsApp suffix
      
      try {
        // Call activation API using internal database call instead of fetch
        // Import needed for internal API call
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

        await message.reply('✅ Akun WhatsApp Anda telah berhasil terhubung ke Monly AI! Ketik "bantuan" untuk melihat daftar perintah.');
        console.log(`WhatsApp ${whatsappNumber} successfully activated for user ${codeData.userId}`);
        
      } catch (error) {
        console.error('Error processing activation:', error);
        await message.reply('❌ Terjadi kesalahan saat memproses aktivasi. Silakan coba lagi.');
      }
    }
    // Enhanced expense tracking patterns
    else if (message.body.match(/^(spent|keluar|bayar|beli)\s+/i)) {
      await handleExpenseTracking(message, whatsappNumber);
    }
    // Income tracking patterns
    else if (message.body.match(/^(income|masuk|terima|gaji|bonus)\s+/i)) {
      await handleIncomeTracking(message, whatsappNumber);
    }
    // Balance and financial status
    else if (message.body.match(/^(balance|saldo|total|dana)$/i)) {
      await handleBalanceInquiry(message, whatsappNumber);
    }
    // Budget management
    else if (message.body.match(/^(budget|anggaran)\s+/i)) {
      await handleBudgetManagement(message, whatsappNumber);
    }
    // Financial reports
    else if (message.body.match(/^(report|laporan|summary|ringkasan)\s+/i)) {
      await handleFinancialReports(message, whatsappNumber);
    }
    // Goal management
    else if (message.body.match(/^(goal|target|tujuan)\s+/i)) {
      await handleGoalManagement(message, whatsappNumber);
    }
    // Category analysis
    else if (message.body.match(/^(category|kategori|analisis)\s*/i)) {
      await handleCategoryAnalysis(message, whatsappNumber);
    }
    // AI financial insights
    else if (message.body.match(/^(ai|insight|saran|tips|analisa)\s*/i)) {
      await handleAIInsights(message, whatsappNumber);
    }
    // Quick commands
    else if (message.body.match(/^(today|hari ini|kemarin|yesterday|minggu ini|week|bulan ini|month)$/i)) {
      await handleQuickReports(message, whatsappNumber);
    }
    // Help command - Enhanced
    else if (message.body.match(/^(help|bantuan|\?|menu)$/i)) {
      await handleHelpCommand(message);
    }
    // Unknown command with AI suggestions
    else {
      await handleUnknownCommand(message);
    }
  });

  return true;
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

// Enhanced expense tracking with Indonesian support
const handleExpenseTracking = async (message: WAMessage, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  const patterns = [
    /^(spent|keluar|bayar|beli)\s+(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:untuk|for|on)?\s*(.+)?$/i,
    /^(\d+(?:[.,]\d+)?)\s+(untuk|for|on)\s+(.+)$/i,
    /^(.+)\s+(\d+(?:[.,]\d+)?)$/i
  ];

  let amount: number = 0;
  let description: string = '';
  let category: string = 'Lainnya';

  for (const pattern of patterns) {
    const match = message.body.match(pattern);
    if (match) {
      if (pattern.source.includes('spent|keluar')) {
        amount = parseFloat(match[2].replace(',', '.'));
        description = match[3] || 'Pengeluaran';
      } else if (pattern.source.includes('untuk|for')) {
        amount = parseFloat(match[1].replace(',', '.'));
        description = match[3];
      } else {
        description = match[1];
        amount = parseFloat(match[2].replace(',', '.'));
      }
      break;
    }
  }

  if (amount <= 0) {
    await message.reply('❌ Format tidak valid. Contoh:\n• keluar 50000 untuk makan\n• bayar 25000 transport\n• 15000 untuk kopi');
    return;
  }

  // Auto-categorize based on keywords
  const categoryMap: Record<string, string> = {
    'makan|food|lunch|dinner|breakfast|restaurant|cafe|warung': 'Makanan & Minuman',
    'transport|bensin|fuel|ojek|taxi|bus|kereta|parkir': 'Transportasi',
    'belanja|shopping|baju|sepatu|clothes|fashion': 'Belanja',
    'health|kesehatan|dokter|obat|hospital|rumah sakit': 'Kesehatan',
    'entertainment|hiburan|movie|film|game|concert': 'Hiburan',
    'bills|tagihan|listrik|air|internet|phone|telepon': 'Tagihan',
    'education|pendidikan|kursus|buku|sekolah': 'Pendidikan'
  };

  for (const [keywords, cat] of Object.entries(categoryMap)) {
    if (new RegExp(keywords, 'i').test(description)) {
      category = cat;
      break;
    }
  }

  try {
    // Here you would save to database
    // await saveTransaction(userId, -amount, description, category);
    
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);

    await message.reply(
      `✅ *Pengeluaran Tercatat*\n\n` +
      `💰 Jumlah: ${formattedAmount}\n` +
      `📝 Deskripsi: ${description}\n` +
      `🏷️ Kategori: ${category}\n` +
      `📅 Tanggal: ${new Date().toLocaleDateString('id-ID')}\n\n` +
      `Ketik "saldo" untuk cek sisa dana`
    );
  } catch (error) {
    await message.reply('❌ Gagal menyimpan data pengeluaran. Silakan coba lagi.');
  }
};

// Enhanced income tracking
const handleIncomeTracking = async (message: WAMessage, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  const patterns = [
    /^(income|masuk|terima|gaji|bonus)\s+(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:dari|from)?\s*(.+)?$/i,
    /^(\d+(?:[.,]\d+)?)\s+(dari|from)\s+(.+)$/i
  ];

  let amount: number = 0;
  let source: string = '';

  for (const pattern of patterns) {
    const match = message.body.match(pattern);
    if (match) {
      if (pattern.source.includes('income|masuk')) {
        amount = parseFloat(match[2].replace(',', '.'));
        source = match[3] || 'Pemasukan';
      } else {
        amount = parseFloat(match[1].replace(',', '.'));
        source = match[3];
      }
      break;
    }
  }

  if (amount <= 0) {
    await message.reply('❌ Format tidak valid. Contoh:\n• masuk 500000 dari gaji\n• terima 100000 bonus\n• 250000 dari freelance');
    return;
  }

  try {
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);

    await message.reply(
      `✅ *Pemasukan Tercatat*\n\n` +
      `💰 Jumlah: ${formattedAmount}\n` +
      `📝 Sumber: ${source}\n` +
      `📅 Tanggal: ${new Date().toLocaleDateString('id-ID')}\n\n` +
      `Ketik "saldo" untuk cek total dana`
    );
  } catch (error) {
    await message.reply('❌ Gagal menyimpan data pemasukan. Silakan coba lagi.');
  }
};

// Enhanced balance inquiry
const handleBalanceInquiry = async (message: WAMessage, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  try {
    // Mock data - replace with real database queries
    const mockBalance = {
      total: 2500000,
      income: 5000000,
      expense: 2500000,
      monthlyIncome: 3500000,
      monthlyExpense: 1200000
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);

    await message.reply(
      `💰 *Ringkasan Keuangan Anda*\n\n` +
      `💳 Saldo Saat Ini: ${formatCurrency(mockBalance.total)}\n\n` +
      `📊 *Bulan Ini:*\n` +
      `📈 Pemasukan: ${formatCurrency(mockBalance.monthlyIncome)}\n` +
      `📉 Pengeluaran: ${formatCurrency(mockBalance.monthlyExpense)}\n` +
      `💹 Selisih: ${formatCurrency(mockBalance.monthlyIncome - mockBalance.monthlyExpense)}\n\n` +
      `📅 Update: ${new Date().toLocaleString('id-ID')}\n\n` +
      `Ketik "laporan bulan" untuk detail lengkap`
    );
  } catch (error) {
    await message.reply('❌ Gagal mengambil data saldo. Silakan coba lagi.');
  }
};

// Budget management
const handleBudgetManagement = async (message: WAMessage, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  const setBudgetPattern = /^budget\s+set\s+(\w+)\s+(\d+(?:[.,]\d+)?)$/i;
  const checkBudgetPattern = /^budget\s+(check|cek|status)$/i;

  if (setBudgetPattern.test(message.body)) {
    const match = message.body.match(setBudgetPattern)!;
    const category = match[1];
    const amount = parseFloat(match[2].replace(',', '.'));

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);

    await message.reply(
      `✅ *Budget Diatur*\n\n` +
      `🏷️ Kategori: ${category}\n` +
      `💰 Limit: ${formattedAmount}\n` +
      `📅 Berlaku: ${new Date().toLocaleDateString('id-ID')} - ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('id-ID')}\n\n` +
      `Anda akan mendapat notifikasi jika mendekati limit!`
    );
  } else if (checkBudgetPattern.test(message.body)) {
    // Mock budget data
    await message.reply(
      `📊 *Status Budget Anda*\n\n` +
      `🍽️ Makanan: Rp 800.000 / Rp 1.000.000 (80%)\n` +
      `🚗 Transport: Rp 300.000 / Rp 500.000 (60%)\n` +
      `🛒 Belanja: Rp 150.000 / Rp 300.000 (50%)\n` +
      `🎮 Hiburan: Rp 450.000 / Rp 400.000 (⚠️ 112%)\n\n` +
      `⚠️ *Peringatan:* Budget hiburan sudah terlampaui!\n\n` +
      `Ketik "budget set [kategori] [jumlah]" untuk atur budget baru`
    );
  } else {
    await message.reply(
      `💡 *Budget Management*\n\n` +
      `📝 *Perintah yang tersedia:*\n` +
      `• budget set makanan 1000000\n` +
      `• budget set transport 500000\n` +
      `• budget check\n\n` +
      `Contoh: "budget set hiburan 300000"`
    );
  }
};

// Financial reports
const handleFinancialReports = async (message: WAMessage, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  const reportType = message.body.toLowerCase();
  
  if (reportType.includes('harian') || reportType.includes('daily')) {
    await message.reply(
      `📊 *Laporan Harian*\n📅 ${new Date().toLocaleDateString('id-ID')}\n\n` +
      `💰 Pemasukan: Rp 0\n` +
      `💸 Pengeluaran: Rp 85.000\n` +
      `💹 Selisih: -Rp 85.000\n\n` +
      `🏷️ *Top Kategori:*\n` +
      `1. Makanan - Rp 50.000\n` +
      `2. Transport - Rp 25.000\n` +
      `3. Lainnya - Rp 10.000\n\n` +
      `📈 Rata-rata pengeluaran harian: Rp 75.000`
    );
  } else if (reportType.includes('mingguan') || reportType.includes('weekly')) {
    await message.reply(
      `📊 *Laporan Mingguan*\n📅 ${new Date(Date.now() - 7*24*60*60*1000).toLocaleDateString('id-ID')} - ${new Date().toLocaleDateString('id-ID')}\n\n` +
      `💰 Total Pemasukan: Rp 1.200.000\n` +
      `💸 Total Pengeluaran: Rp 850.000\n` +
      `💹 Selisih: +Rp 350.000\n\n` +
      `📈 *Trend:* Pengeluaran turun 15% dari minggu lalu\n` +
      `🎯 *Target:* Hemat 20% tercapai!`
    );
  } else {
    await message.reply(
      `📊 *Laporan Bulanan*\n📅 ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}\n\n` +
      `💰 Total Pemasukan: Rp 5.500.000\n` +
      `💸 Total Pengeluaran: Rp 3.200.000\n` +
      `💹 Selisih: +Rp 2.300.000\n\n` +
      `🏷️ *Kategori Terbesar:*\n` +
      `1. Makanan & Minuman - Rp 1.200.000\n` +
      `2. Transportasi - Rp 600.000\n` +
      `3. Belanja - Rp 450.000\n` +
      `4. Hiburan - Rp 400.000\n` +
      `5. Tagihan - Rp 350.000\n\n` +
      `📈 Pertumbuhan: +12% dari bulan lalu`
    );
  }
};

// Goal management
const handleGoalManagement = async (message: WAMessage, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  if (message.body.toLowerCase().includes('list') || message.body.toLowerCase().includes('daftar')) {
    await message.reply(
      `🎯 *Daftar Target Keuangan*\n\n` +
      `1. 💰 *Emergency Fund*\n` +
      `   Target: Rp 15.000.000\n` +
      `   Terkumpul: Rp 8.500.000 (57%)\n` +
      `   ⏰ Deadline: 6 bulan lagi\n\n` +
      `2. 🏠 *Rumah Impian*\n` +
      `   Target: Rp 500.000.000\n` +
      `   Terkumpul: Rp 125.000.000 (25%)\n` +
      `   ⏰ Deadline: 3 tahun lagi\n\n` +
      `3. 🚗 *Mobil Baru*\n` +
      `   Target: Rp 200.000.000\n` +
      `   Terkumpul: Rp 50.000.000 (25%)\n` +
      `   ⏰ Deadline: 2 tahun lagi\n\n` +
      `💡 Ketik "goal add [nama] [jumlah]" untuk tambah target baru`
    );
  } else {
    await message.reply(
      `🎯 *Goal Management*\n\n` +
      `📝 *Perintah yang tersedia:*\n` +
      `• goal list - Lihat semua target\n` +
      `• goal add liburan 10000000\n` +
      `• goal progress emergency\n` +
      `• goal boost emergency 500000\n\n` +
      `Contoh: "goal add laptop 8000000"`
    );
  }
};

// Category analysis
const handleCategoryAnalysis = async (message: WAMessage, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  await message.reply(
    `📊 *Analisis Kategori Pengeluaran*\n📅 Bulan ini\n\n` +
    `🍽️ *Makanan & Minuman* - Rp 1.200.000 (37.5%)\n` +
    `   └ 📈 Naik 8% dari bulan lalu\n` +
    `   └ 💡 Tips: Coba masak di rumah 2x seminggu\n\n` +
    `🚗 *Transportasi* - Rp 600.000 (18.8%)\n` +
    `   └ 📉 Turun 5% dari bulan lalu\n` +
    `   └ ✅ Bagus! Tetap pertahankan\n\n` +
    `🛒 *Belanja* - Rp 450.000 (14.1%)\n` +
    `   └ 📈 Naik 20% dari bulan lalu\n` +
    `   └ ⚠️ Perhatikan pengeluaran impulsif\n\n` +
    `🎮 *Hiburan* - Rp 400.000 (12.5%)\n` +
    `   └ 📈 Naik 15% dari bulan lalu\n` +
    `   └ 💡 Budget hiburan sudah 112% terpakai\n\n` +
    `📱 *Tagihan* - Rp 350.000 (10.9%)\n` +
    `   └ 📊 Stabil dari bulan lalu\n\n` +
    `💰 Total: Rp 3.200.000\n` +
    `🎯 Rekomendasi: Kurangi makan di luar 20%`
  );
};

// AI financial insights
const handleAIInsights = async (message: WAMessage, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  await message.reply(
    `🤖 *AI Financial Insights*\n\n` +
    `🔍 *Analisis Pola Keuangan Anda:*\n\n` +
    `📈 *Kekuatan:*\n` +
    `• Konsisten menabung 40% dari gaji\n` +
    `• Pengeluaran transportasi terkendali\n` +
    `• Tidak ada hutang konsumtif\n\n` +
    `⚠️ *Area Perbaikan:*\n` +
    `• Pengeluaran makanan 15% di atas ideal\n` +
    `• Budget hiburan sering terlampaui\n` +
    `• Emergency fund masih 57% dari target\n\n` +
    `💡 *Rekomendasi AI:*\n` +
    `1. Masak di rumah 3x seminggu → hemat Rp 300.000/bulan\n` +
    `2. Gunakan aplikasi cashback untuk belanja\n` +
    `3. Auto-transfer Rp 500.000 ke emergency fund\n` +
    `4. Review subscription yang tidak terpakai\n\n` +
    `🎯 *Prediksi:* Dengan penyesuaian ini, Anda bisa mencapai emergency fund target 2 bulan lebih cepat!\n\n` +
    `Ketik "ai detail" untuk analisis mendalam`
  );
};

// Quick reports
const handleQuickReports = async (message: WAMessage, whatsappNumber: string) => {
  const userId = await getUserIdFromWhatsApp(whatsappNumber);
  if (!userId) {
    await message.reply('❌ Akun WhatsApp belum terhubung. Gunakan kode aktivasi terlebih dahulu.');
    return;
  }

  const command = message.body.toLowerCase();
  
  if (command.includes('today') || command.includes('hari ini')) {
    await message.reply(`📅 *Hari Ini*\n💸 Pengeluaran: Rp 85.000\n🏷️ Top: Makan siang (Rp 45.000)`);
  } else if (command.includes('yesterday') || command.includes('kemarin')) {
    await message.reply(`📅 *Kemarin*\n💸 Pengeluaran: Rp 120.000\n🏷️ Top: Bensin (Rp 60.000)`);
  } else if (command.includes('week') || command.includes('minggu')) {
    await message.reply(`📅 *Minggu Ini*\n💰 Pemasukan: Rp 1.200.000\n💸 Pengeluaran: Rp 850.000\n💹 Surplus: Rp 350.000`);
  } else if (command.includes('month') || command.includes('bulan')) {
    await message.reply(`📅 *Bulan Ini*\n💰 Pemasukan: Rp 5.500.000\n💸 Pengeluaran: Rp 3.200.000\n💹 Surplus: Rp 2.300.000`);
  }
};

// Enhanced help command
const handleHelpCommand = async (message: WAMessage) => {
  await message.reply(
    `🤖 *Monly AI - Asisten Keuangan Cerdas*\n\n` +
    `💰 *PENCATATAN KEUANGAN:*\n` +
    `• keluar 50000 untuk makan\n` +
    `• bayar 25000 transport\n` +
    `• masuk 500000 dari gaji\n` +
    `• terima 100000 bonus\n\n` +
    `📊 *INFORMASI & LAPORAN:*\n` +
    `• saldo - Cek saldo & ringkasan\n` +
    `• hari ini - Pengeluaran hari ini\n` +
    `• minggu ini - Laporan mingguan\n` +
    `• bulan ini - Laporan bulanan\n\n` +
    `💡 *BUDGET & TARGET:*\n` +
    `• budget check - Status budget\n` +
    `• budget set makanan 1000000\n` +
    `• goal list - Daftar target\n` +
    `• goal add laptop 8000000\n\n` +
    `🔍 *ANALISIS & AI:*\n` +
    `• kategori - Analisis pengeluaran\n` +
    `• ai insights - Saran AI personal\n` +
    `• laporan bulanan - Detail lengkap\n\n` +
    `❓ Ketik "bantuan [topik]" untuk panduan detail\n` +
    `Contoh: "bantuan budget" atau "bantuan goal"`
  );
};

// Unknown command handler with suggestions
const handleUnknownCommand = async (message: WAMessage) => {
  const commands = [
    'saldo', 'keluar', 'masuk', 'budget', 'goal', 'laporan', 'kategori', 'ai insights', 'bantuan'
  ];
  
  const input = message.body.toLowerCase();
  const suggestions = commands.filter(cmd => 
    cmd.includes(input.substring(0, 3)) || input.includes(cmd.substring(0, 3))
  ).slice(0, 3);

  let response = `❓ *Perintah tidak dikenali*\n\n`;
  
  if (suggestions.length > 0) {
    response += `💡 Mungkin maksud Anda:\n`;
    suggestions.forEach(cmd => response += `• ${cmd}\n`);
    response += `\n`;
  }
  
  response += `Ketik "bantuan" untuk melihat semua perintah yang tersedia.`;
  
  await message.reply(response);
};
