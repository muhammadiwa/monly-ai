import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import OpenAI from 'openai';
import { analyzeTransactionText, processReceiptImage } from './openai';
import { storage } from './storage';

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
}

// Store single WhatsApp connection
let botConnection: SingleBotConnection | null = null;

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
    authStrategy: new LocalAuth({ clientId: 'monly-single-bot' }),
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
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      executablePath: process.env.NODE_ENV === 'production' ? 
        (process.env.CHROME_PATH || '/usr/bin/google-chrome-stable') : undefined,
      timeout: 30000
    },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
  });

  // Create connection object
  botConnection = {
    client,
    status: 'initializing',
    qrCode: null,
    reconnectAttempts: 0,
    lastReconnectTime: 0,
    autoReconnect: true,
    maxReconnectAttempts: 5
  };

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
    
    // Register universal message handlers
    registerUniversalMessageHandlers();
    
    // Send info about available chats
    client.getChats().then(chats => {
      console.log(`📱 WhatsApp Bot has access to ${chats.length} chats`);
    }).catch(console.error);
  });

  client.on('authenticated', () => {
    console.log('✅ Monly WhatsApp Bot authenticated successfully');
    botConnection!.status = 'authenticated';
    botConnection!.reconnectAttempts = 0;
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

  client.on('message_create', (message) => {
    // Log outgoing messages for debugging
    if (message.fromMe) {
      console.log(`📤 Bot sent message to ${message.to}: ${message.body}`);
    }
  });

  // Initialize the client with retry logic
  const initializeWithRetry = async (attempt = 1) => {
    try {
      await client.initialize();
      console.log('✅ Monly WhatsApp Bot initialized successfully');
      botConnection!.reconnectAttempts = 0;
    } catch (error) {
      console.error(`❌ Failed to initialize WhatsApp Bot (attempt ${attempt}):`, error);
      botConnection!.status = 'disconnected';
      
      // Handle specific errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ERR_INSUFFICIENT_RESOURCES') || 
          errorMessage.includes('net::ERR_') ||
          errorMessage.includes('Target closed')) {
        
        if (attempt < 3) { // Retry up to 3 times for network errors
          console.log(`🔄 Retrying WhatsApp Bot initialization in ${attempt * 10} seconds...`);
          setTimeout(() => {
            initializeWithRetry(attempt + 1);
          }, attempt * 10000); // Exponential backoff: 10s, 20s, 30s
          return;
        }
      }
      
      // If max retries reached or other error, mark as failed
      console.error('❌ Failed to initialize WhatsApp Bot: Connection failed');
    }
  };

  initializeWithRetry();

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
        resolve({
          success: false,
          status: 'timeout',
          message: 'Bot reconnection timeout'
        });
      }, 60000); // 60 second timeout
      
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
        } else if (botConnection.status === 'disconnected') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: false,
            status: botConnection.status,
            message: 'Bot reconnection failed'
          });
        }
      }, 1000);
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
      qrCode: null
    };
  }

  return {
    connected: botConnection.status === 'ready' || botConnection.status === 'authenticated',
    status: botConnection.status,
    qrCode: botConnection.qrCode
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

/**
 * Register universal message handlers for all users
 */
const registerUniversalMessageHandlers = (): void => {
  if (!botConnection || botConnection.status !== 'ready') {
    console.error('Cannot register message handlers: Bot not ready');
    return;
  }

  // Handle incoming messages with comprehensive AI processing
  botConnection.client.on('message', async (message: any) => {
    console.log(`📥 Message received from ${message.from}: ${message.body}`);
    
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
        
        // Process as transaction text (reuse existing logic)
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

  console.log('✅ Universal message handlers registered for WhatsApp Bot');
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
