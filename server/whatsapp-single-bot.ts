import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import OpenAI from 'openai';
import { analyzeTransactionText, processReceiptImage } from './openai';
import { storage } from './storage';
import { existsSync } from 'fs';

// Helper function to get timezone from environment
function getTimezone(): string {
  return process.env.TZ || 'Asia/Jakarta';
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "default_key"
});

// Single WhatsApp bot instance
interface SingleBotConnection {
  client: any;
  status: 'initializing' | 'loading_screen' | 'qr_received' | 'authenticated' | 'ready' | 'disconnected';
  qrCode: string | null;
  reconnectAttempts: number;
  lastReconnectTime: number;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  lastError: string | null;
}

// Store single WhatsApp connection
let botConnection: SingleBotConnection | null = null;

/**
 * Auto-detect Chromium executable path
 * Di Linux server, lebih baik pakai bundled Puppeteer Chromium
 * karena system Chromium (terutama Snap) punya banyak restrictions
 */
function findChromiumPath(): string | undefined {
  // Check env variable first - user bisa override jika perlu
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log(`📱 Using custom Chromium: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Di Linux server, JANGAN pakai system Chromium karena:
  // - Snap Chromium punya SingletonLock issue
  // - APT chromium-browser biasanya symlink ke Snap
  // Lebih baik pakai bundled Puppeteer Chromium

  // Hanya auto-detect di Windows/macOS (development)
  if (process.platform === 'win32') {
    const windowsPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const chromePath of windowsPaths) {
      if (existsSync(chromePath)) {
        console.log(`🔍 Auto-detected Chrome: ${chromePath}`);
        return chromePath;
      }
    }
  } else if (process.platform === 'darwin') {
    const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (existsSync(macPath)) {
      console.log(`🔍 Auto-detected Chrome: ${macPath}`);
      return macPath;
    }
  }

  // Linux atau tidak ditemukan - pakai bundled Puppeteer Chromium
  console.log('📱 Using bundled Puppeteer Chromium');
  return undefined;
}

/**
 * Get Puppeteer configuration
 */
function getPuppeteerConfig() {
  const chromePath = findChromiumPath();

  const config: any = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process'
    ],
    headless: true,
  };

  if (chromePath) {
    config.executablePath = chromePath;
  }

  return config;
}

/**
 * Initialize single WhatsApp bot for all users
 * @returns The WhatsApp connection object
 */
export const initializeSingleWhatsAppBot = (): SingleBotConnection => {
  // If bot already exists and is connected, return it
  if (botConnection && (botConnection.status === 'ready' || botConnection.status === 'authenticated')) {
    return botConnection;
  }

  // Create a new client with local authentication
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'monly-bot' }),
    puppeteer: getPuppeteerConfig()
  });

  // Create connection object
  botConnection = {
    client,
    status: 'initializing',
    qrCode: null,
    reconnectAttempts: 0,
    lastReconnectTime: 0,
    autoReconnect: true,
    maxReconnectAttempts: 5,
    lastError: null
  };

  // ============================================
  // REGISTER ALL EVENT HANDLERS BEFORE INITIALIZE
  // ============================================

  // Debug: Log all events
  client.on('change_state', (state) => {
    console.log('🔄 WhatsApp state changed:', state);
  });

  // Track processed messages to prevent duplicates
  const processedMessages = new Set<string>();

  // Handle incoming messages - MUST be registered before initialize()
  // Using 'message' event only (more reliable than message_create)
  client.on('message', async (message: any) => {
    console.log('📩 [message event] Received message:', {
      from: message.from,
      body: message.body?.substring(0, 50),
      type: message.type,
      id: message.id._serialized,
      timestamp: new Date().toISOString()
    });

    // Deduplication: Check if we already processed this message
    const messageId = message.id._serialized;
    if (processedMessages.has(messageId)) {
      console.log('⏭️ Skipping duplicate message:', messageId);
      return;
    }

    // Mark as processed
    processedMessages.add(messageId);

    // Clean up old processed messages (keep only last 100)
    if (processedMessages.size > 100) {
      const firstItem = processedMessages.values().next().value;
      if (firstItem) {
        processedMessages.delete(firstItem);
      }
    }

    await handleIncomingMessage(message);
  });

  // Set up event handlers
  client.on('qr', async (qr) => {
    console.log('📱 QR Code received for Monly WhatsApp Bot');
    try {
      // Generate QR code as data URL
      botConnection!.qrCode = await qrcode.toDataURL(qr);
      botConnection!.status = 'qr_received';
      console.log('📱 WhatsApp Bot QR code generated successfully');
    } catch (err) {
      console.error('Error generating QR code:', err);
      botConnection!.qrCode = qr; // Fallback to raw QR string
      botConnection!.status = 'qr_received';
    }
  });

  client.on('ready', () => {
    console.log('✅ Monly WhatsApp Bot is ready!');
    botConnection!.status = 'ready';
    botConnection!.qrCode = null;
    botConnection!.reconnectAttempts = 0;

    // Send info about available chats
    client.getChats().then(chats => {
      console.log(`📱 WhatsApp Bot has access to ${chats.length} chats`);
      console.log('✅ Message event listener is active and ready to receive messages');
    }).catch(console.error);
  });

  client.on('authenticated', () => {
    console.log('✅ Monly WhatsApp Bot authenticated successfully');
    botConnection!.status = 'authenticated';
    botConnection!.reconnectAttempts = 0;
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`📱 WhatsApp loading: ${percent}% - ${message}`);
  });

  client.on('auth_failure', (msg) => {
    console.error(`❌ WhatsApp Bot authentication failed: ${msg}`);
    botConnection!.status = 'disconnected';

    // Attempt auto-reconnection for auth failures
    if (botConnection!.autoReconnect && botConnection!.reconnectAttempts < botConnection!.maxReconnectAttempts) {
      const now = Date.now();
      const timeSinceLastReconnect = now - botConnection!.lastReconnectTime;
      const minReconnectInterval = 60000; // 1 minute minimum for auth failures

      if (timeSinceLastReconnect >= minReconnectInterval) {
        botConnection!.reconnectAttempts++;
        botConnection!.lastReconnectTime = now;

        console.log(`🔄 Auto-reconnecting WhatsApp Bot after auth failure (attempt ${botConnection!.reconnectAttempts}/${botConnection!.maxReconnectAttempts})`);

        // Schedule reconnection with longer delay for auth failures
        const backoffDelay = Math.min(60000 * Math.pow(2, botConnection!.reconnectAttempts - 1), 600000); // Max 10 minutes

        setTimeout(async () => {
          try {
            await reconnectSingleWhatsAppBot();
          } catch (error) {
            console.error('Failed to reconnect WhatsApp Bot after auth failure:', error);
          }
        }, backoffDelay);
      }
    }
  });

  client.on('disconnected', (reason) => {
    console.log(`📱 WhatsApp Bot disconnected: ${reason}`);
    botConnection!.status = 'disconnected';

    // Attempt auto-reconnection if enabled
    if (botConnection!.autoReconnect && botConnection!.reconnectAttempts < botConnection!.maxReconnectAttempts) {
      const now = Date.now();
      const timeSinceLastReconnect = now - botConnection!.lastReconnectTime;
      const minReconnectInterval = 30000; // 30 seconds minimum between reconnection attempts

      if (timeSinceLastReconnect >= minReconnectInterval) {
        botConnection!.reconnectAttempts++;
        botConnection!.lastReconnectTime = now;

        console.log(`🔄 Auto-reconnecting WhatsApp Bot (attempt ${botConnection!.reconnectAttempts}/${botConnection!.maxReconnectAttempts})`);

        // Schedule reconnection with exponential backoff
        const backoffDelay = Math.min(30000 * Math.pow(2, botConnection!.reconnectAttempts - 1), 300000); // Max 5 minutes

        setTimeout(async () => {
          try {
            await reconnectSingleWhatsAppBot();
          } catch (error) {
            console.error('Failed to reconnect WhatsApp Bot:', error);
          }
        }, backoffDelay);
      }
    } else {
      console.log('❌ Max reconnection attempts reached for WhatsApp Bot');
    }
  });

  // Initialize the client with retry logic and timeout
  const initializeWithRetry = async (attempt = 1) => {
    try {
      // Set a timeout for initialization (90 seconds)
      const initTimeout = setTimeout(() => {
        if (botConnection && botConnection.status === 'initializing') {
          console.error('❌ WhatsApp Bot initialization timeout (90s)');
          botConnection.status = 'disconnected';
          botConnection.lastError = 'Initialization timeout - Chromium browser failed to start';
        }
      }, 90000);

      await client.initialize();
      clearTimeout(initTimeout);
      console.log('✅ Monly WhatsApp Bot initialized successfully');
      botConnection!.reconnectAttempts = 0;
      botConnection!.lastError = null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to initialize WhatsApp Bot (attempt ${attempt}):`, errorMessage);

      // Store error
      if (botConnection) {
        botConnection.lastError = errorMessage;
      }

      // Handle browser launch errors - don't retry
      if (errorMessage.includes('Failed to launch the browser') ||
        errorMessage.includes('cannot open shared object file')) {
        console.error('❌ Chromium browser error - check system dependencies');
        botConnection!.status = 'disconnected';
        return;
      }

      // Handle network errors - retry
      if (errorMessage.includes('ERR_INSUFFICIENT_RESOURCES') ||
        errorMessage.includes('net::ERR_') ||
        errorMessage.includes('Target closed') ||
        errorMessage.includes('Protocol error')) {

        if (attempt < 3) {
          console.log(`🔄 Retrying WhatsApp Bot initialization in ${attempt * 10} seconds...`);
          setTimeout(() => {
            initializeWithRetry(attempt + 1);
          }, attempt * 10000);
          return;
        }
      }

      // Mark as failed
      console.error('❌ Failed to initialize WhatsApp Bot after all retries');
      botConnection!.status = 'disconnected';
    }
  };

  // Start initialization in background
  initializeWithRetry().catch(err => {
    console.error('❌ WhatsApp Bot initialization error:', err);
    if (botConnection) {
      botConnection.status = 'disconnected';
      botConnection.lastError = err instanceof Error ? err.message : String(err);
    }
  });

  return botConnection;
};

/**
 * Reconnect single WhatsApp bot
 * @returns Promise with reconnection result
 */
export const reconnectSingleWhatsAppBot = async (): Promise<{ success: boolean; status: string; message: string; qrCode?: string }> => {
  try {
    // Cleanup existing connection
    if (botConnection) {
      try {
        await botConnection.client.destroy();
      } catch (error) {
        console.error('Error destroying existing WhatsApp Bot connection:', error);
      }
    }

    console.log('🔄 Starting WhatsApp Bot reconnection process...');

    // Create new connection
    const connection = initializeSingleWhatsAppBot();

    // Wait for connection result with timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Even if timeout, check if we have QR code
        if (botConnection && botConnection.qrCode && botConnection.status === 'qr_received') {
          resolve({
            success: true,
            status: botConnection.status,
            message: 'QR code generated (timeout reached but QR available)',
            qrCode: botConnection.qrCode
          });
        } else {
          resolve({
            success: false,
            status: 'timeout',
            message: 'Bot reconnection timeout - no QR code generated'
          });
        }
      }, 30000); // Reduced timeout to 30 seconds for faster QR response

      const checkInterval = setInterval(() => {
        if (!botConnection) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: false,
            status: 'disconnected',
            message: 'Connection lost during reconnection'
          });
          return;
        }

        // Prioritize QR code generation - return immediately when QR is available
        if (botConnection.qrCode && botConnection.status === 'qr_received') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: true,
            status: botConnection.status,
            message: 'QR code generated for bot reconnection',
            qrCode: botConnection.qrCode
          });
        } else if (botConnection.status === 'ready' || botConnection.status === 'authenticated') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: true,
            status: botConnection.status,
            message: 'WhatsApp Bot reconnected successfully'
          });
        }
        // Remove the immediate disconnected check - let it try longer
      }, 500); // Check more frequently (every 500ms) for faster QR detection
    });

  } catch (error) {
    console.error('Error during WhatsApp Bot reconnection:', error);
    return {
      success: false,
      status: 'error',
      message: 'Failed to start bot reconnection process'
    };
  }
};

/**
 * Get the current bot connection state
 * @returns The connection state or null if not connected
 */
export const getSingleBotConnectionState = () => {
  if (!botConnection) {
    return {
      connected: false,
      status: 'disconnected',
      qrCode: null,
      lastError: null
    };
  }

  return {
    connected: botConnection.status === 'ready' || botConnection.status === 'authenticated',
    status: botConnection.status,
    qrCode: botConnection.qrCode,
    lastError: botConnection.lastError
  };
};

/**
 * Send a message using the single bot
 * @param whatsappNumber The target WhatsApp number
 * @param message The message to send
 * @returns Promise with result
 */
export const sendSingleBotMessage = async (
  whatsappNumber: string,
  message: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    if (!botConnection || botConnection.status !== 'ready') {
      return {
        success: false,
        message: 'WhatsApp Bot not ready'
      };
    }

    // Format the number correctly
    const chatId = whatsappNumber.includes('@c.us') ? whatsappNumber : `${whatsappNumber}@c.us`;

    await botConnection.client.sendMessage(chatId, message);

    return {
      success: true
    };

  } catch (error) {
    console.error('Error sending WhatsApp Bot message:', error);
    return {
      success: false,
      message: 'Failed to send message'
    };
  }
};

/**
 * Disconnect single WhatsApp bot
 * @returns Promise with result
 */
export const disconnectSingleWhatsAppBot = async (): Promise<{ success: boolean; message: string }> => {
  try {
    if (!botConnection) {
      return {
        success: false,
        message: 'No WhatsApp Bot connection found'
      };
    }

    await botConnection.client.destroy();
    botConnection = null;

    return {
      success: true,
      message: 'WhatsApp Bot disconnected successfully'
    };
  } catch (error) {
    console.error('Error disconnecting WhatsApp Bot:', error);
    return {
      success: false,
      message: 'Failed to disconnect WhatsApp Bot'
    };
  }
};

// Removed registerUniversalMessageHandlers - no longer needed

/**
 * Handle incoming WhatsApp message
 */
const handleIncomingMessage = async (message: any): Promise<void> => {
  try {
    // Skip messages from self
    if (message.fromMe) {
      return;
    }

    console.log(`📥 Processing message from ${message.from}: ${message.body}`);

    // Get WhatsApp number without suffix
    const whatsappNumber = message.from.replace('@c.us', '');

    // Skip messages from groups or status updates
    if (message.from.includes('@g.us') || message.from.includes('status@broadcast')) {
      console.log('⏭️ Skipping group/status message');
      return;
    }

    // Get user ID from WhatsApp number
    const messageUserId = await getUserIdFromWhatsApp(whatsappNumber);
    console.log(`👤 User lookup for ${whatsappNumber}: ${messageUserId || 'NOT FOUND'}`);

    if (!messageUserId) {
      // Check for activation command first
      const activationPattern = /^AKTIVASI:\s*([A-Z0-9]{6})$/i;
      const activationMatch = message.body?.match(activationPattern);

      if (activationMatch) {
        console.log(`🔑 Activation code detected: ${activationMatch[1]}`);
        await handleActivationCode(message, activationMatch[1].toUpperCase(), whatsappNumber);
      } else {
        console.log('📤 Sending "account not connected" message');
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

      // Pre-filter: Check if message looks like a transaction before calling AI
      // Import helper functions from whatsapp-service
      const { isLikelyTransaction, handleCasualMessage } = await import('./whatsapp-service');
      const transactionLikelihood = isLikelyTransaction(messageText);

      if (transactionLikelihood === 'unlikely') {
        await handleCasualMessage(message, messageText);
        return;
      }

      if (transactionLikelihood === 'ambiguous') {
        await message.reply(
          `🤔 *Apakah ini transaksi?*\n\n` +
          `Pesan Anda: "${message.body}"\n\n` +
          `Jika ini transaksi, silakan kirim ulang dengan format:\n` +
          `• "Beli [item] [jumlah]"\n` +
          `• "Bayar [item] [jumlah]"\n` +
          `• "Terima [sumber] [jumlah]"\n\n` +
          `Atau ketik *"bantuan"* untuk panduan lengkap.`
        );
        return;
      }

      // Process as transaction text (only for likely transactions)
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
    console.error('❌ Error processing WhatsApp message:', error);
    try {
      await message.reply(
        `❌ *Terjadi Kesalahan*\n\n` +
        `Maaf, terjadi kesalahan dalam memproses pesan Anda. Silakan coba lagi nanti.`
      );
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
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

// Helper function to handle activation code
const handleActivationCode = async (message: any, code: string, whatsappNumber: string) => {
  try {
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

// Import existing helper functions from whatsapp-service.ts
const processTextMessage = async (message: any, userId: string) => {
  // Import and use existing processTextMessage logic from whatsapp-service.ts
  const { processTextMessage: originalProcessTextMessage } = await import('./whatsapp-service');
  return originalProcessTextMessage(message, userId);
};

const processVoiceMessage = async (message: any, userId: string) => {
  // Import and use existing processVoiceMessage logic from whatsapp-service.ts
  const { processVoiceMessage: originalProcessVoiceMessage } = await import('./whatsapp-service');
  return originalProcessVoiceMessage(message, userId);
};

const processImageMessage = async (message: any, userId: string) => {
  // Import and use existing processImageMessage logic from whatsapp-service.ts
  const { processImageMessage: originalProcessImageMessage } = await import('./whatsapp-service');
  return originalProcessImageMessage(message, userId);
};

const showHelpMessage = async (message: any) => {
  // Import and use existing showHelpMessage logic from whatsapp-service.ts
  const { showHelpMessage: originalShowHelpMessage } = await import('./whatsapp-service');
  return originalShowHelpMessage(message);
};

const showBalanceSummary = async (message: any, userId: string) => {
  // Import and use existing showBalanceSummary logic from whatsapp-service.ts
  const { showBalanceSummary: originalShowBalanceSummary } = await import('./whatsapp-service');
  return originalShowBalanceSummary(message, userId);
};
