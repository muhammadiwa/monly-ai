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

// Type definitions for WhatsApp Web.js
type WAClient = InstanceType<typeof Client>;
type WAMessage = any; // WhatsApp message type

interface WhatsAppConnection {
  client: WAClient;
  status: 'initializing' | 'loading_screen' | 'qr_received' | 'authenticated' | 'ready' | 'disconnected';
  qrCode: string | null;
  userId: string;
  reconnectAttempts: number;
  lastReconnectTime: number;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
}

// Store WhatsApp connections by user ID
const connections: Map<string, WhatsAppConnection> = new Map();

// Health check interval for connections
const healthCheckInterval = setInterval(async () => {
  const entries = Array.from(connections.entries());
  for (const [userId, connection] of entries) {
    if (connection.status === 'ready') {
      try {
        // Simple health check by trying to get state
        const state = await connection.client.getState();
        if (state !== 'CONNECTED') {
          console.log(`⚠️ WhatsApp connection unhealthy for user ${userId}, state: ${state}`);
          connection.status = 'disconnected';

          // Trigger reconnection if enabled
          if (connection.autoReconnect && connection.reconnectAttempts < connection.maxReconnectAttempts) {
            console.log(`🔄 Health check triggered reconnection for user ${userId}`);
            setTimeout(async () => {
              try {
                await reconnectWhatsAppClient(userId);
              } catch (error) {
                console.error(`Health check reconnection failed for user ${userId}:`, error);
              }
            }, 5000); // 5 second delay
          }
        }
      } catch (error) {
        console.error(`Health check failed for user ${userId}:`, error);
        connection.status = 'disconnected';
      }
    }
  }
}, 300000); // Check every 5 minutes

// Cleanup health check on process exit
process.on('exit', () => {
  clearInterval(healthCheckInterval);
});

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
  const connection: WhatsAppConnection = {
    client,
    status: 'initializing',
    qrCode: null,
    userId,
    reconnectAttempts: 0,
    lastReconnectTime: 0,
    autoReconnect: true,
    maxReconnectAttempts: 5
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
    console.log(`✅ WhatsApp client ready for user ${userId}`);
    connection.status = 'ready';
    connection.qrCode = null;
    connection.reconnectAttempts = 0; // Reset reconnection attempts on successful connection

    // Register message handlers when client is ready
    registerMessageHandlers(userId);

    // Send welcome message to user's own number if possible
    client.getChats().then(chats => {
      console.log(`User ${userId} has ${chats.length} chats available`);
    }).catch(console.error);
  });

  client.on('authenticated', () => {
    console.log(`✅ WhatsApp client authenticated for user ${userId}`);
    connection.status = 'authenticated';
    connection.reconnectAttempts = 0; // Reset reconnection attempts on successful authentication
  });

  client.on('auth_failure', (msg) => {
    console.error(`WhatsApp authentication failed for user ${userId}: ${msg}`);
    connection.status = 'disconnected';

    // Attempt auto-reconnection for auth failures too
    if (connection.autoReconnect && connection.reconnectAttempts < connection.maxReconnectAttempts) {
      const now = Date.now();
      const timeSinceLastReconnect = now - connection.lastReconnectTime;
      const minReconnectInterval = 60000; // 1 minute minimum for auth failures

      if (timeSinceLastReconnect >= minReconnectInterval) {
        connection.reconnectAttempts++;
        connection.lastReconnectTime = now;

        console.log(`🔄 Auto-reconnecting after auth failure for user ${userId} (attempt ${connection.reconnectAttempts}/${connection.maxReconnectAttempts})`);

        // Schedule reconnection with longer delay for auth failures
        const backoffDelay = Math.min(60000 * Math.pow(2, connection.reconnectAttempts - 1), 600000); // Max 10 minutes

        setTimeout(async () => {
          try {
            await reconnectWhatsAppClient(userId);
          } catch (error) {
            console.error(`Failed to reconnect WhatsApp after auth failure for user ${userId}:`, error);
          }
        }, backoffDelay);
      }
    }
  });

  client.on('disconnected', (reason) => {
    console.log(`WhatsApp client disconnected for user ${userId}: ${reason}`);
    connection.status = 'disconnected';

    // Attempt auto-reconnection if enabled
    if (connection.autoReconnect && connection.reconnectAttempts < connection.maxReconnectAttempts) {
      const now = Date.now();
      const timeSinceLastReconnect = now - connection.lastReconnectTime;
      const minReconnectInterval = 30000; // 30 seconds minimum between reconnection attempts

      if (timeSinceLastReconnect >= minReconnectInterval) {
        connection.reconnectAttempts++;
        connection.lastReconnectTime = now;

        console.log(`🔄 Auto-reconnecting WhatsApp for user ${userId} (attempt ${connection.reconnectAttempts}/${connection.maxReconnectAttempts})`);

        // Schedule reconnection with exponential backoff
        const backoffDelay = Math.min(30000 * Math.pow(2, connection.reconnectAttempts - 1), 300000); // Max 5 minutes

        setTimeout(async () => {
          try {
            await reconnectWhatsAppClient(userId);
          } catch (error) {
            console.error(`Failed to reconnect WhatsApp for user ${userId}:`, error);
          }
        }, backoffDelay);
      }
    } else {
      console.log(`❌ Max reconnection attempts reached for user ${userId}, cleaning up connection`);
      // Clean up connection after max attempts
      connections.delete(userId);
    }
  });

  client.on('message_create', (message) => {
    // Log outgoing messages for debugging
    if (message.fromMe) {
      console.log(`Sent message to ${message.to}: ${message.body}`);
    }
  });

  // Store the connection
  connections.set(userId, connection);

  // Initialize the client with retry logic
  const initializeWithRetry = async (attempt = 1) => {
    try {
      await client.initialize();
      console.log(`✅ WhatsApp client initialized successfully for user ${userId}`);
      connection.reconnectAttempts = 0; // Reset counter on successful connection
    } catch (error) {
      console.error(`❌ Failed to initialize WhatsApp client for user ${userId} (attempt ${attempt}):`, error);
      connection.status = 'disconnected';

      // Handle specific errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ERR_INSUFFICIENT_RESOURCES') ||
        errorMessage.includes('net::ERR_') ||
        errorMessage.includes('Target closed')) {

        if (attempt < 3) { // Retry up to 3 times for network errors
          console.log(`🔄 Retrying WhatsApp initialization for user ${userId} in ${attempt * 10} seconds...`);
          setTimeout(() => {
            initializeWithRetry(attempt + 1);
          }, attempt * 10000); // Exponential backoff: 10s, 20s, 30s
          return;
        }
      }

      // If max retries reached or other error, mark as failed
      console.error(`❌ Failed to initialize WhatsApp client for user ${userId}: Connection failed`);
    }
  };

  initializeWithRetry();

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
 * Reconnect WhatsApp client for a specific user
 * @param userId The user ID to reconnect
 * @returns Promise with reconnection result
 */
export const reconnectWhatsAppClient = async (userId: string): Promise<{ success: boolean; status: string; message: string; qrCode?: string }> => {
  try {
    const existingConnection = connections.get(userId);

    // Cleanup existing connection
    if (existingConnection) {
      try {
        await existingConnection.client.destroy();
      } catch (error) {
        console.error(`Error destroying existing connection for user ${userId}:`, error);
      }
      connections.delete(userId);
    }

    console.log(`🔄 Starting reconnection process for user ${userId}...`);

    // Create new connection
    const connection = initializeWhatsAppClient(userId);

    // Wait for connection result with timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          status: 'timeout',
          message: 'Reconnection timeout'
        });
      }, 60000); // 60 second timeout

      const checkInterval = setInterval(() => {
        const currentConnection = connections.get(userId);
        if (!currentConnection) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: false,
            status: 'disconnected',
            message: 'Connection lost during reconnection'
          });
          return;
        }

        if (currentConnection.qrCode && currentConnection.status === 'qr_received') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: true,
            status: currentConnection.status,
            message: 'QR code generated for reconnection',
            qrCode: currentConnection.qrCode
          });
        } else if (currentConnection.status === 'ready' || currentConnection.status === 'authenticated') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: true,
            status: currentConnection.status,
            message: 'WhatsApp reconnected successfully'
          });
        } else if (currentConnection.status === 'disconnected') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve({
            success: false,
            status: currentConnection.status,
            message: 'Reconnection failed'
          });
        }
      }, 1000);
    });

  } catch (error) {
    console.error('Error during WhatsApp reconnection:', error);
    return {
      success: false,
      status: 'error',
      message: 'Failed to start reconnection process'
    };
  }
};

/**
 * Enable/disable auto-reconnection for a user
 * @param userId The user ID
 * @param autoReconnect Whether to enable auto-reconnection
 * @returns Success status
 */
export const setAutoReconnect = (userId: string, autoReconnect: boolean): { success: boolean; message: string } => {
  const connection = connections.get(userId);
  if (!connection) {
    return {
      success: false,
      message: 'No WhatsApp connection found for this user'
    };
  }

  connection.autoReconnect = autoReconnect;
  console.log(`🔄 Auto-reconnection ${autoReconnect ? 'enabled' : 'disabled'} for user ${userId}`);

  return {
    success: true,
    message: `Auto-reconnection ${autoReconnect ? 'enabled' : 'disabled'}`
  };
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
      } else if (existingConnection.status === 'disconnected') {
        // If connection is disconnected, try to reconnect
        console.log(`🔄 Existing connection is disconnected, attempting reconnection for user ${userId}...`);
        return await reconnectWhatsAppClient(userId);
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

        // Check if it's a savings/goals command
        if (messageText.includes('nabung') ||
          messageText.includes('menabung') ||
          messageText.includes('saving') ||
          messageText.includes('tabung') ||
          messageText.includes('goal') ||
          messageText.includes('tujuan') ||
          messageText.includes('target') ||
          messageText.includes('buat goal') ||
          messageText.includes('create goal') ||
          messageText.includes('daftar goal') ||
          messageText.includes('list goal') ||
          messageText.includes('cek tabungan') ||
          messageText.includes('check savings') ||
          messageText.includes('saldo goal') ||
          messageText.includes('goal balance') ||
          messageText.includes('kembalikan') ||
          messageText.includes('kembalikan dana') ||
          messageText.includes('tarik dana') ||
          messageText.includes('return') ||
          messageText.includes('refund') ||
          messageText.includes('withdraw') ||
          messageText.includes('hapus goal') ||
          messageText.includes('delete goal') ||
          messageText.includes('transfer') && (messageText.includes('dari') || messageText.includes('from'))) {
          await processSavingsCommand(message, messageUserId);
          return;
        }

        // Check if it's a category command
        if (messageText.includes('kategori') ||
          messageText.includes('category') ||
          messageText.includes('buat kategori') ||
          messageText.includes('create category') ||
          messageText.includes('tambah kategori') ||
          messageText.includes('add category') ||
          messageText.includes('ubah kategori') ||
          messageText.includes('edit category') ||
          messageText.includes('hapus kategori') ||
          messageText.includes('delete category') ||
          messageText.includes('daftar kategori') ||
          messageText.includes('list category')) {
          await processCategoryCommand(message, messageUserId);
          return;
        }

        // Pre-filter: Check if message looks like a transaction before calling AI
        const transactionLikelihood = isLikelyTransaction(messageText);

        if (transactionLikelihood === 'unlikely') {
          // Handle casual/greeting messages without calling AI
          await handleCasualMessage(message, messageText);
          return;
        }

        if (transactionLikelihood === 'ambiguous') {
          // For ambiguous messages, ask for clarification
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

/**
 * Pre-filter function to determine if a message is likely a transaction
 * Returns: 'likely' | 'unlikely' | 'ambiguous'
 */
export const isLikelyTransaction = (messageText: string): 'likely' | 'unlikely' | 'ambiguous' => {
  const text = messageText.toLowerCase().trim();

  // UNLIKELY: Greetings and casual messages (no amount indicators)
  const casualPatterns = [
    /^(halo|hai|hi|hello|hey|selamat\s+(pagi|siang|sore|malam))$/i,
    /^(ok|oke|okay|siap|baik|mantap|sip|iya|ya|yup|yoi|yap)$/i,
    /^(terima\s*kasih|makasih|thanks|thank\s*you|thx|tq)$/i,
    /^(maaf|sorry|sori)$/i,
    /^(gimana|bagaimana|apa\s*kabar|how\s*are\s*you)$/i,
    /^(bye|dadah|sampai\s*jumpa|see\s*you)$/i,
    /^(wkwk|haha|hihi|lol|😂|🤣|😁|👍|🙏)+$/i,
    /^.{1,3}$/i, // Very short messages (1-3 chars)
  ];

  for (const pattern of casualPatterns) {
    if (pattern.test(text)) {
      return 'unlikely';
    }
  }

  // LIKELY: Contains amount indicators (numbers with currency/unit)
  const amountPatterns = [
    /\d+\s*(rb|ribu|jt|juta|k|m|miliar)/i, // Indonesian amounts
    /rp\.?\s*\d+/i, // Rupiah prefix
    /\$\s*\d+/i, // Dollar prefix
    /\d{4,}/i, // Large numbers (4+ digits, likely amounts)
    /\d+[.,]\d{3}/i, // Numbers with thousand separators
  ];

  const hasAmount = amountPatterns.some(pattern => pattern.test(text));

  // LIKELY: Contains transaction keywords WITH amounts
  const transactionKeywords = [
    'beli', 'bayar', 'byr', 'transfer', 'tf', 'kirim', 'terima', 'dapat',
    'gaji', 'salary', 'bonus', 'income', 'pendapatan', 'pemasukan',
    'makan', 'lunch', 'dinner', 'breakfast', 'sarapan',
    'bensin', 'parkir', 'tol', 'transport', 'grab', 'gojek', 'ojol',
    'belanja', 'shopping', 'groceries', 'supermarket', 'minimarket',
    'listrik', 'air', 'internet', 'pulsa', 'token', 'tagihan',
    'sewa', 'rent', 'cicilan', 'kredit', 'hutang', 'pinjam',
    'jual', 'sell', 'sold', 'laku'
  ];

  const hasTransactionKeyword = transactionKeywords.some(keyword =>
    text.includes(keyword)
  );

  if (hasAmount && hasTransactionKeyword) {
    return 'likely';
  }

  if (hasAmount) {
    // Has amount but no clear transaction keyword - still likely
    return 'likely';
  }

  // AMBIGUOUS: Has transaction keyword but no amount
  if (hasTransactionKeyword) {
    return 'ambiguous';
  }

  // Questions are usually not transactions
  if (text.includes('?') || text.startsWith('apa') || text.startsWith('kenapa') ||
    text.startsWith('mengapa') || text.startsWith('bagaimana') || text.startsWith('kapan') ||
    text.startsWith('dimana') || text.startsWith('siapa')) {
    return 'unlikely';
  }

  // Default: ambiguous for longer messages, unlikely for short ones
  if (text.length < 10) {
    return 'unlikely';
  }

  return 'ambiguous';
};

/**
 * Handle casual/greeting messages without calling AI
 */
export const handleCasualMessage = async (message: any, messageText: string) => {
  const text = messageText.toLowerCase().trim();

  // Greetings
  if (/^(halo|hai|hi|hello|hey)$/i.test(text)) {
    await message.reply(
      `👋 *Halo!*\n\n` +
      `Saya Monly Bot, asisten keuangan Anda.\n\n` +
      `Untuk mencatat transaksi, kirim pesan seperti:\n` +
      `• "Makan siang 50000"\n` +
      `• "Gaji bulan ini 5jt"\n\n` +
      `Ketik *"bantuan"* untuk panduan lengkap.`
    );
    return;
  }

  // Time-based greetings
  if (/^selamat\s+(pagi|siang|sore|malam)$/i.test(text)) {
    const greeting = text.includes('pagi') ? 'pagi' :
      text.includes('siang') ? 'siang' :
        text.includes('sore') ? 'sore' : 'malam';
    await message.reply(
      `🌟 *Selamat ${greeting} juga!*\n\n` +
      `Ada transaksi yang ingin dicatat hari ini?\n\n` +
      `Ketik *"bantuan"* untuk panduan penggunaan.`
    );
    return;
  }

  // Thank you messages
  if (/^(terima\s*kasih|makasih|thanks|thank\s*you|thx|tq)$/i.test(text)) {
    await message.reply(
      `🙏 *Sama-sama!*\n\n` +
      `Senang bisa membantu. Jika ada transaksi lain, langsung kirim saja ya!`
    );
    return;
  }

  // Acknowledgments
  if (/^(ok|oke|okay|siap|baik|mantap|sip|iya|ya|yup|yoi|yap)$/i.test(text)) {
    // Don't reply to simple acknowledgments to avoid spam
    return;
  }

  // Emojis only - check if message has no alphanumeric characters (likely just emojis/symbols)
  if (!/[a-zA-Z0-9]/.test(text) && text.length > 0) {
    // Don't reply to emoji-only messages
    return;
  }

  // Very short messages
  if (text.length <= 3) {
    // Don't reply to very short messages
    return;
  }

  // Default response for other casual messages
  await message.reply(
    `🤖 *Hai!*\n\n` +
    `Saya adalah bot pencatat keuangan. Untuk mencatat transaksi, kirim pesan dengan format:\n\n` +
    `📝 *Contoh:*\n` +
    `• "Beli kopi 25000"\n` +
    `• "Bayar listrik 150rb"\n` +
    `• "Gaji 5jt"\n\n` +
    `Ketik *"bantuan"* untuk panduan lengkap.`
  );
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

// Helper function to get user goals
const getUserGoals = async (userId: string) => {
  try {
    return await storage.getGoals(userId);
  } catch (error) {
    console.error('Error getting user goals:', error);
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

      if (analysis.type === 'expense') {
        // Check if category has existing budget for alerts only
        const existingBudget = await storage.getBudgetByCategory(userId, matchingCategory.id);

        if (existingBudget) {
          // Check for budget alerts on existing budget
          budgetAlert = await checkBudgetAlerts(userId, matchingCategory.id, userPreferences);
        }
      }

      return {
        success: true,
        transaction,
        analysis,
        budgetAlert
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
export const processTextMessage = async (message: any, userId: string) => {
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
              timeZone: getTimezone()
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
          `\n_Transaksi telah disimpan dalam akun Anda_`;

        // Add budget alert if exists
        if (result.budgetAlert) {
          replyMessage += `\n\n` + result.budgetAlert.message;
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
export const processVoiceMessage = async (message: any, userId: string) => {
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
              timeZone: getTimezone()
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
          dateInfo;

        // Add budget alert if exists
        if (result.budgetAlert) {
          replyMessage += `\n\n` + result.budgetAlert.message;
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
export const processImageMessage = async (message: any, userId: string) => {
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
                timeZone: getTimezone()
              };
              dateInfo = ` (${transactionDate.toLocaleDateString('id-ID', options)})`;
            }
          }

          responses.push(
            `✅ ${transaction.description}${dateInfo}\n` +
            `💰 ${formattedAmount} (${transaction.category})`
          );
        }
      }

      if (successCount > 0) {
        let replyMessage = `📸 *Struk Berhasil Diproses!*\n\n` +
          `📝 Teks yang ditemukan:\n"${result.text}"\n\n` +
          `✅ *${successCount} Transaksi Dicatat:*\n\n` +
          responses.join('\n\n');

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

    // Better error messages based on error type
    let errorMsg = `❌ *Gagal Memproses Gambar*\n\n`;

    if (error instanceof Error) {
      if (error.message.includes("timeout") || error.message.includes("took too long")) {
        errorMsg += `⏱️ Proses gambar terlalu lama (timeout).\n\n` +
          `💡 *Saran:*\n` +
          `• Kirim gambar yang lebih kecil/jelas\n` +
          `• Pastikan koneksi internet stabil\n` +
          `• Atau kirim detail transaksi via teks`;
      } else if (error.message.includes("rate limit")) {
        errorMsg += `⚠️ Terlalu banyak permintaan.\n\n` +
          `Tunggu sebentar dan coba lagi.`;
      } else if (error.message.includes("invalid") || error.message.includes("format")) {
        errorMsg += `📸 Format gambar tidak valid.\n\n` +
          `Kirim foto struk yang jelas.`;
      } else {
        errorMsg += `Terjadi kesalahan dalam memproses gambar.\n\n` +
          `Silakan coba lagi atau kirim detail transaksi via teks.`;
      }
    } else {
      errorMsg += `Terjadi kesalahan dalam memproses gambar.\n\n` +
        `Silakan coba lagi atau kirim detail transaksi via teks.`;
    }

    await message.reply(errorMsg);
  }
};

// Helper function to show help message
export const showHelpMessage = async (message: any) => {
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
    `🎯 *Tabungan & Goal:*\n` +
    `• "buat goal emergency fund target 10 juta" - Buat goal baru\n` +
    `• "nabung 100000 untuk liburan" - Menabung ke goal\n` +
    `• "daftar goal" - Lihat goal aktif\n` +
    `• "daftar goal completed" - Lihat goal tercapai/arsip\n` +
    `• "transfer 500000 dari emergency ke liburan" - Transfer antar goal\n` +
    `• "kembalikan dana beli laptop ke saldo" - Kembalikan dana ke saldo utama\n` +
    `• "hapus goal emergency fund" - Hapus goal (dengan proteksi)\n` +
    `• "cek tabungan" - Ringkasan tabungan\n\n` +
    `�️ *Manajemen Kategori:*\n` +
    `• "buat kategori [nama] [emoji] [warna]" - Buat kategori baru\n` +
    `• "daftar kategori" - Lihat semua kategori\n` +
    `• "ubah kategori [nama lama] menjadi [nama baru]" - Ubah nama\n` +
    `• "hapus kategori [nama]" - Hapus kategori\n\n` +
    `�📱 *Perintah Lain:*\n` +
    `• ketik "bantuan" - Lihat pesan ini\n` +
    `• ketik "saldo" - Cek ringkasan keuangan\n` +
    `• ketik "status" - Status koneksi akun\n\n` +
    `💡 *Tips:* Semakin jelas informasi yang Anda berikan, semakin akurat pencatatan transaksi!`
  );
};

// Helper function to show balance/summary
export const showBalanceSummary = async (message: any, userId: string) => {
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
    const { analyzeBudgetCommand, analyzeCategoryCommand } = await import('./openai');

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

// Helper function to process category commands
const processCategoryCommand = async (message: any, userId: string) => {
  try {
    const userPreferences = await getUserPreferences(userId);
    const categories = await getUserCategories(userId);

    console.log(`Analyzing category command for user ${userId}: ${message.body}`);

    // Import category analysis function
    const { analyzeCategoryCommand } = await import('./openai');

    // Create preferences object for AI analysis
    const aiPreferences = {
      defaultCurrency: userPreferences?.defaultCurrency || 'USD',
      language: userPreferences?.language || 'id',
      autoCategorize: userPreferences?.autoCategorize || false
    };

    // Analyze the category command with AI
    const analysis = await analyzeCategoryCommand(message.body, categories, aiPreferences);
    console.log('Category command analysis result:', analysis);

    if (analysis.confidence > 0.7) {
      const result = await handleCategoryAction(userId, analysis, userPreferences, categories);

      if (result.success) {
        await message.reply(result.message);
      } else {
        await message.reply(
          `❌ *Gagal Mengelola Kategori*\n\n` +
          `${result.message}\n\n` +
          `Silakan coba lagi atau hubungi support.`
        );
      }
    } else {
      await message.reply(
        `🤔 *Perintah Kategori Tidak Dipahami*\n\n` +
        `Maaf, saya tidak dapat memahami perintah kategori Anda.\n\n` +
        `Contoh perintah yang bisa dipahami:\n` +
        `• "buat kategori Kopi ☕ #8B4513"\n` +
        `• "daftar kategori"\n` +
        `• "ubah kategori Food menjadi Makanan"\n` +
        `• "hapus kategori Lain-lain"\n\n` +
        `Atau ketik *"bantuan"* untuk panduan lengkap.`
      );
    }

  } catch (error) {
    console.error('Error processing category command:', error);
    await message.reply(
      `❌ *Terjadi Kesalahan*\n\n` +
      `Maaf, terjadi kesalahan dalam memproses perintah kategori Anda. Silakan coba lagi nanti.`
    );
  }
};

// Helper function to process savings/goals commands
const processSavingsCommand = async (message: any, userId: string) => {
  try {
    const userPreferences = await getUserPreferences(userId);
    const goals = await getUserGoals(userId);

    console.log(`Analyzing savings command for user ${userId}: ${message.body}`);

    // Import savings analysis function
    const { analyzeSavingsCommand } = await import('./openai');

    // Create preferences object for AI analysis
    const aiPreferences = {
      defaultCurrency: userPreferences?.defaultCurrency || 'USD',
      language: userPreferences?.language || 'id',
      autoCategorize: userPreferences?.autoCategorize || false
    };

    // Analyze the savings command with AI
    const analysis = await analyzeSavingsCommand(message.body, goals, aiPreferences);
    console.log('Savings command analysis result:', analysis);

    if (analysis.confidence > 0.7) {
      const result = await handleSavingsAction(userId, analysis, userPreferences, goals);

      if (result.success) {
        await message.reply(result.message);
      } else {
        await message.reply(
          `❌ *Gagal Mengelola Tabungan*\n\n` +
          `${result.message}\n\n` +
          `Silakan coba lagi atau hubungi support.`
        );
      }
    } else {
      await message.reply(
        `🤔 *Perintah Tabungan Tidak Dipahami*\n\n` +
        `Maaf, saya tidak dapat memahami perintah tabungan/goal Anda.\n\n` +
        `Contoh perintah yang bisa dipahami:\n` +
        `• "nabung 100000 untuk liburan"\n` +
        `• "buat goal emergency fund target 10 juta"\n` +
        `• "daftar goal saya"\n` +
        `• "daftar goal completed"\n` +
        `• "transfer 500000 dari emergency ke liburan"\n` +
        `• "hapus goal emergency fund"\n` +
        `• "cek tabungan"\n` +
        `• "set rencana nabung 500rb per bulan untuk laptop"\n\n` +
        `Atau ketik *"bantuan"* untuk panduan lengkap.`
      );
    }

  } catch (error) {
    console.error('Error processing savings command:', error);
    await message.reply(
      `❌ *Terjadi Kesalahan*\n\n` +
      `Maaf, terjadi kesalahan dalam memproses perintah tabungan Anda. Silakan coba lagi nanti.`
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

// Helper function to handle category actions
const handleCategoryAction = async (
  userId: string,
  analysis: any,
  userPreferences: any,
  categories: any[]
) => {
  try {
    const { storage } = await import('./storage');

    switch (analysis.action) {
      case 'create':
        if (!analysis.categoryName) {
          return {
            success: false,
            message: 'Nama kategori harus disebutkan'
          };
        }

        // Check if category already exists
        const existingCategory = categories.find(c =>
          c.name.toLowerCase() === analysis.categoryName.toLowerCase()
        );

        if (existingCategory) {
          return {
            success: false,
            message: `Kategori "${analysis.categoryName}" sudah ada`
          };
        }

        // Create new category
        const newCategory = await storage.createCategory({
          name: analysis.categoryName,
          icon: analysis.icon || '📝',
          color: analysis.color || '#6B7280',
          type: analysis.type || 'expense',
          userId: userId,
          isDefault: false
        });

        return {
          success: true,
          message: `✅ *Kategori Berhasil Dibuat!*\n\n` +
            `📂 Nama: ${newCategory.name}\n` +
            `${newCategory.icon} Icon: ${newCategory.icon}\n` +
            `🎨 Warna: ${newCategory.color}\n` +
            `📊 Jenis: ${newCategory.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}\n\n` +
            `_Kategori baru sudah tersedia untuk transaksi_`
        };

      case 'update':
        if (!analysis.categoryName || !analysis.newCategoryName) {
          return {
            success: false,
            message: 'Nama kategori lama dan baru harus disebutkan'
          };
        }

        // Find category to update
        const categoryToUpdate = categories.find(c =>
          c.name.toLowerCase() === analysis.categoryName.toLowerCase()
        );

        if (!categoryToUpdate) {
          return {
            success: false,
            message: `Kategori "${analysis.categoryName}" tidak ditemukan`
          };
        }

        // Check if new name already exists
        const nameConflict = categories.find(c =>
          c.name.toLowerCase() === analysis.newCategoryName.toLowerCase() &&
          c.id !== categoryToUpdate.id
        );

        if (nameConflict) {
          return {
            success: false,
            message: `Nama kategori "${analysis.newCategoryName}" sudah digunakan`
          };
        }

        // Update category
        await storage.updateCategory(categoryToUpdate.id, {
          name: analysis.newCategoryName
        });

        return {
          success: true,
          message: `✅ *Kategori Berhasil Diubah!*\n\n` +
            `📂 Nama Lama: ${analysis.categoryName}\n` +
            `📂 Nama Baru: ${analysis.newCategoryName}\n\n` +
            `_Kategori telah diperbarui_`
        };

      case 'delete': {
        if (!analysis.categoryName) {
          return {
            success: false,
            message: 'Nama kategori yang akan dihapus harus disebutkan'
          };
        }

        // Find category to delete
        const categoryToDelete = categories.find(c =>
          c.name.toLowerCase() === analysis.categoryName.toLowerCase()
        );

        if (!categoryToDelete) {
          return {
            success: false,
            message: `Kategori "${analysis.categoryName}" tidak ditemukan`
          };
        }

        // Check if category is default
        if (categoryToDelete.isDefault) {
          return {
            success: false,
            message: `Kategori "${analysis.categoryName}" adalah kategori default dan tidak dapat dihapus`
          };
        }

        // Check if category has transactions
        const transactions = await storage.getTransactions(userId);
        const categoryTransactions = transactions.filter(t => t.categoryId === categoryToDelete.id);
        if (categoryTransactions.length > 0) {
          return {
            success: false,
            message: `Kategori "${analysis.categoryName}" memiliki ${categoryTransactions.length} transaksi dan tidak dapat dihapus. Pindahkan transaksi ke kategori lain terlebih dahulu.`
          };
        }

        // Delete category (assuming deleteCategory takes categoryId and userId)
        await storage.deleteCategory(categoryToDelete.id, userId);

        return {
          success: true,
          message: `✅ *Kategori Berhasil Dihapus!*\n\n` +
            `📂 Kategori: ${categoryToDelete.name}\n\n` +
            `_Kategori telah dihapus dari sistem_`
        };
      }

      case 'list': {
        const categoryList = await getCategoryList(userId, userPreferences);
        return {
          success: true,
          message: categoryList
        };
      }

      default:
        return {
          success: false,
          message: 'Perintah kategori tidak dikenali'
        };
    }

  } catch (error) {
    console.error('Error handling category action:', error);
    return {
      success: false,
      message: 'Gagal mengelola kategori'
    };
  }
};

// Helper function to handle savings actions
const handleSavingsAction = async (
  userId: string,
  analysis: any,
  userPreferences: any,
  goals: any[]
) => {
  try {
    const { storage } = await import('./storage');

    switch (analysis.action) {
      case 'save':
        if (!analysis.amount || analysis.amount <= 0) {
          return {
            success: false,
            message: 'Jumlah tabungan harus disebutkan dan lebih dari 0'
          };
        }

        // Find the goal to save to
        let targetGoal = null;
        if (analysis.goalName) {
          targetGoal = goals.find(g =>
            g.name.toLowerCase().includes(analysis.goalName.toLowerCase())
          );
        } else if (goals.length === 1) {
          // If only one goal, use it
          targetGoal = goals[0];
        }

        if (!targetGoal && goals.length > 1) {
          const goalsList = goals.map(g =>
            `• ${g.name} (${formatCurrency(g.currentAmount, userPreferences?.defaultCurrency)}/${formatCurrency(g.targetAmount, userPreferences?.defaultCurrency)})`
          ).join('\n');

          return {
            success: false,
            message: `🎯 *Pilih Goal untuk Nabung*\n\n` +
              `Anda memiliki beberapa goal:\n${goalsList}\n\n` +
              `Contoh: "nabung 100000 untuk liburan"`
          };
        }

        if (!targetGoal) {
          return {
            success: false,
            message: `🎯 *Goal Tidak Ditemukan*\n\n` +
              `${analysis.goalName ? `Goal "${analysis.goalName}" tidak ditemukan. ` : ''}` +
              `Anda belum memiliki goal aktif.\n\n` +
              `Buat goal baru dengan:\n` +
              `"buat goal emergency fund target 10 juta"`
          };
        }

        // Create goal boost (savings contribution)
        const boost = await storage.createGoalBoost(
          targetGoal.id,
          userId,
          analysis.amount,
          `Nabung ke ${targetGoal.name}`
        );

        const updatedGoal = await storage.getGoalById(targetGoal.id);
        if (!updatedGoal) {
          return {
            success: false,
            message: 'Gagal memperbarui informasi goal'
          };
        }

        const progress = Math.min((updatedGoal.currentAmount / updatedGoal.targetAmount) * 100, 100);
        const remainingAmount = Math.max(updatedGoal.targetAmount - updatedGoal.currentAmount, 0);

        const formattedAmount = formatCurrency(analysis.amount, userPreferences?.defaultCurrency);
        const formattedCurrentAmount = formatCurrency(updatedGoal.currentAmount, userPreferences?.defaultCurrency);
        const formattedTargetAmount = formatCurrency(updatedGoal.targetAmount, userPreferences?.defaultCurrency);
        const formattedRemaining = formatCurrency(remainingAmount, userPreferences?.defaultCurrency);

        let statusMessage = '';
        if (progress >= 100) {
          // Auto-archive completed goal to preserve history
          await storage.updateGoal(updatedGoal.id, {
            isActive: false,
            description: updatedGoal.description + ' [COMPLETED]'
          });

          statusMessage = `\n\n🎉 *SELAMAT! Goal Tercapai!*\n` +
            `Target "${updatedGoal.name}" sudah 100% terpenuhi! 🎯✨\n\n` +
            `📦 *Goal Diarsipkan*\n` +
            `Goal ini telah dipindahkan ke arsip untuk menjaga history tabungan Anda.\n\n` +
            `💡 *Tips Selanjutnya:*\n` +
            `• Buat goal baru: "buat goal [nama] target [jumlah]"\n` +
            `• Lihat arsip: "daftar goal completed"\n` +
            `• Transfer dana: Dana tersimpan aman di goal ini`;
        } else if (progress >= 75) {
          statusMessage = `\n\n🔥 *Hampir Tercapai!*\n` +
            `Tinggal ${formattedRemaining} lagi untuk mencapai target!`;
        } else if (progress >= 50) {
          statusMessage = `\n\n💪 *Setengah Jalan!*\n` +
            `Sudah ${progress.toFixed(0)}% dari target tercapai!`;
        }

        return {
          success: true,
          message: `✅ *Tabungan Berhasil Dicatat!*\n\n` +
            `💰 Jumlah: ${formattedAmount}\n` +
            `🎯 Goal: ${updatedGoal.name}\n` +
            `📊 Progress: ${formattedCurrentAmount} / ${formattedTargetAmount} (${progress.toFixed(1)}%)\n` +
            `📈 Sisa Target: ${formattedRemaining}${statusMessage}\n\n` +
            `_Tabungan telah ditambahkan ke goal Anda_`
        };

      case 'create_goal':
        if (!analysis.goalName || !analysis.targetAmount) {
          return {
            success: false,
            message: 'Nama goal dan target jumlah harus disebutkan'
          };
        }

        // Check if goal with same name already exists
        const existingGoal = goals.find(g =>
          g.name.toLowerCase() === analysis.goalName.toLowerCase()
        );

        if (existingGoal) {
          return {
            success: false,
            message: `Goal "${analysis.goalName}" sudah ada`
          };
        }

        // Set default deadline if not provided (1 year from now)
        const deadline = analysis.deadline || Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

        // Create new goal
        const newGoal = await storage.createGoal({
          userId: userId,
          name: analysis.goalName,
          targetAmount: analysis.targetAmount,
          currentAmount: 0,
          deadline: deadline,
          category: analysis.category || 'general',
          description: analysis.description || `Goal created via WhatsApp`,
          isActive: true
        });

        const formattedGoalTarget = formatCurrency(analysis.targetAmount, userPreferences?.defaultCurrency);
        const deadlineDate = new Date(deadline * 1000);
        const formattedDeadline = deadlineDate.toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        return {
          success: true,
          message: `✅ *Goal Berhasil Dibuat!*\n\n` +
            `🎯 Nama: ${newGoal.name}\n` +
            `💰 Target: ${formattedGoalTarget}\n` +
            `📅 Deadline: ${formattedDeadline}\n` +
            `📂 Kategori: ${newGoal.category}\n\n` +
            `Mulai nabung dengan:\n` +
            `*"nabung 100000 untuk ${newGoal.name}"*`
        };

      case 'list_goals':
        // Check if user wants to see completed/archived goals
        const showArchived = analysis.goalName &&
          (analysis.goalName.toLowerCase().includes('completed') ||
            analysis.goalName.toLowerCase().includes('tercapai') ||
            analysis.goalName.toLowerCase().includes('arsip'));

        return {
          success: true,
          message: await getGoalsList(userId, userPreferences, showArchived)
        };

      case 'check_balance':
        return {
          success: true,
          message: await getGoalsBalance(userId, userPreferences)
        };

      case 'set_plan':
        if (!analysis.goalName || !analysis.amount || !analysis.frequency) {
          return {
            success: false,
            message: 'Goal, jumlah, dan frekuensi harus disebutkan untuk rencana tabungan'
          };
        }

        // Find the goal
        const planGoal = goals.find(g =>
          g.name.toLowerCase().includes(analysis.goalName.toLowerCase())
        );

        if (!planGoal) {
          return {
            success: false,
            message: `Goal "${analysis.goalName}" tidak ditemukan`
          };
        }

        // Create savings plan
        const savingsPlan = await storage.createGoalSavingsPlan(
          planGoal.id,
          userId,
          analysis.amount,
          analysis.frequency
        );

        const formattedPlanAmount = formatCurrency(analysis.amount, userPreferences?.defaultCurrency);
        const frequencyText = analysis.frequency === 'weekly' ? 'per minggu' :
          analysis.frequency === 'monthly' ? 'per bulan' : 'per tahun';

        return {
          success: true,
          message: `✅ *Rencana Tabungan Dibuat!*\n\n` +
            `🎯 Goal: ${planGoal.name}\n` +
            `💰 Jumlah: ${formattedPlanAmount} ${frequencyText}\n` +
            `📅 Mulai: Sekarang\n\n` +
            `_Rencana tabungan otomatis telah diaktifkan_`
        };

      case 'transfer_goal':
        if (!analysis.amount || !analysis.goalName || !analysis.targetGoalName) {
          return {
            success: false,
            message: 'Untuk transfer dana, sebutkan jumlah, goal asal, dan goal tujuan\n\nContoh: "transfer 500000 dari emergency fund ke liburan"'
          };
        }

        // Find source goal
        const sourceGoal = goals.find(g =>
          g.name.toLowerCase().includes(analysis.goalName.toLowerCase())
        );

        if (!sourceGoal) {
          return {
            success: false,
            message: `Goal asal "${analysis.goalName}" tidak ditemukan`
          };
        }

        if (sourceGoal.currentAmount < analysis.amount) {
          const available = formatCurrency(sourceGoal.currentAmount, userPreferences?.defaultCurrency);
          const requested = formatCurrency(analysis.amount, userPreferences?.defaultCurrency);
          return {
            success: false,
            message: `Saldo goal "${sourceGoal.name}" tidak mencukupi.\nTersedia: ${available}\nDiminta: ${requested}`
          };
        }

        // Find target goal
        const destinationGoal = goals.find(g =>
          g.name.toLowerCase().includes(analysis.targetGoalName.toLowerCase()) &&
          g.id !== sourceGoal.id
        );

        if (!destinationGoal) {
          return {
            success: false,
            message: `Goal tujuan "${analysis.targetGoalName}" tidak ditemukan`
          };
        }

        // Perform transfer
        const newSourceAmount = sourceGoal.currentAmount - analysis.amount;
        const newTargetAmount = Math.min(destinationGoal.currentAmount + analysis.amount, destinationGoal.targetAmount);
        const actualTransfer = newTargetAmount - destinationGoal.currentAmount;

        await storage.updateGoal(sourceGoal.id, { currentAmount: newSourceAmount });
        await storage.updateGoal(destinationGoal.id, { currentAmount: newTargetAmount });

        // Record transfer transactions
        const transferAmount = formatCurrency(actualTransfer, userPreferences?.defaultCurrency);

        return {
          success: true,
          message: `✅ *Transfer Dana Berhasil!*\n\n` +
            `💸 Dari: ${sourceGoal.name}\n` +
            `💰 Ke: ${destinationGoal.name}\n` +
            `💵 Jumlah: ${transferAmount}\n\n` +
            `📊 *Update Saldo:*\n` +
            `• ${sourceGoal.name}: ${formatCurrency(newSourceAmount, userPreferences?.defaultCurrency)}\n` +
            `• ${destinationGoal.name}: ${formatCurrency(newTargetAmount, userPreferences?.defaultCurrency)}` +
            (actualTransfer < analysis.amount ? `\n\n⚠️ Transfer disesuaikan agar tidak melebihi target goal tujuan` : '')
        };

      case 'return_funds':
        if (!analysis.goalName) {
          return {
            success: false,
            message: 'Nama goal untuk pengembalian dana harus disebutkan\n\nContoh: "kembalikan dana beli laptop ke saldo"'
          };
        }

        const goalToReturn = goals.find(g =>
          g.name.toLowerCase().includes(analysis.goalName.toLowerCase())
        );

        if (!goalToReturn) {
          return {
            success: false,
            message: `Goal "${analysis.goalName}" tidak ditemukan`
          };
        }

        if (goalToReturn.currentAmount <= 0) {
          return {
            success: false,
            message: `Goal "${goalToReturn.name}" tidak memiliki dana untuk dikembalikan`
          };
        }

        // Determine amount to return
        const returnAmount = analysis.amount && analysis.amount > 0
          ? Math.min(analysis.amount, goalToReturn.currentAmount)
          : goalToReturn.currentAmount;

        // Find or create refund category
        const categories = await getUserCategories(userId);
        let refundCategory = categories.find(c =>
          c.name.toLowerCase() === "goal refund" || c.name.toLowerCase() === "pengembalian goal"
        );

        if (!refundCategory) {
          refundCategory = await storage.createCategory({
            userId,
            name: "Pengembalian Goal",
            type: "income",
            icon: "🔄",
            color: "#10B981"
          });
        }

        // Create refund transaction (income to return money to balance)
        const refundTransaction = await storage.createTransaction({
          userId,
          amount: returnAmount,
          description: `Pengembalian Dana dari Goal: ${goalToReturn.name}`,
          categoryId: refundCategory.id,
          type: 'income',
          date: Math.floor(Date.now() / 1000),
          currency: userPreferences?.defaultCurrency || 'IDR'
        });

        // Update goal amount (subtract the returned amount)
        const newGoalAmount = goalToReturn.currentAmount - returnAmount;
        await storage.updateGoal(goalToReturn.id, {
          currentAmount: newGoalAmount
        });

        return {
          success: true,
          message: `✅ *Dana Berhasil Dikembalikan!*\n\n` +
            `💰 Jumlah: ${formatCurrency(returnAmount, userPreferences?.defaultCurrency)}\n` +
            `🎯 Dari Goal: ${goalToReturn.name}\n` +
            `💳 Dikembalikan ke saldo utama\n\n` +
            `📊 *Sisa di Goal:* ${formatCurrency(newGoalAmount, userPreferences?.defaultCurrency)}\n\n` +
            `_Dana telah ditambahkan ke saldo utama Anda_`
        };

      case 'delete_goal':
        if (!analysis.goalName) {
          return {
            success: false,
            message: 'Nama goal yang akan dihapus harus disebutkan\n\nContoh: "hapus goal emergency fund"'
          };
        }

        const goalToDelete = goals.find(g =>
          g.name.toLowerCase().includes(analysis.goalName.toLowerCase())
        );

        if (!goalToDelete) {
          return {
            success: false,
            message: `Goal "${analysis.goalName}" tidak ditemukan`
          };
        }

        return await handleGoalDeletion(userId, goalToDelete, userPreferences, goals);

      default:
        return {
          success: false,
          message: 'Perintah tabungan tidak dikenali'
        };
    }

  } catch (error) {
    console.error('Error handling savings action:', error);
    return {
      success: false,
      message: 'Gagal mengelola tabungan'
    };
  }
};

// Helper function to get goals list
const getGoalsList = async (userId: string, userPreferences: any, includeArchived: boolean = false) => {
  try {
    const { storage } = await import('./storage');

    const goals = await storage.getGoals(userId);

    if (!goals || goals.length === 0) {
      return `🎯 *Daftar Goal Anda*\n\n` +
        `Anda belum memiliki goal keuangan.\n\n` +
        `Buat goal baru dengan:\n` +
        `• "buat goal emergency fund target 10 juta"\n` +
        `• "buat goal liburan target 5 juta deadline 31 desember"`;
    }

    let listMessages = [`🎯 *Daftar Goal Anda*\n`];

    // Group by status
    const activeGoals = goals.filter(g => g.isActive && g.currentAmount < g.targetAmount);
    const completedGoals = goals.filter(g => !g.isActive || g.currentAmount >= g.targetAmount);

    if (includeArchived && completedGoals.length > 0) {
      listMessages.push(`\n🏆 **Goal Tercapai/Arsip:**`);
      completedGoals.forEach((goal, index) => {
        const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
        const formattedCurrent = formatCurrency(goal.currentAmount, userPreferences?.defaultCurrency);
        const formattedTarget = formatCurrency(goal.targetAmount, userPreferences?.defaultCurrency);
        const completedDate = new Date((goal.updatedAt || goal.createdAt || Date.now() / 1000) * 1000);
        const formattedCompleted = completedDate.toLocaleDateString('id-ID', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        listMessages.push(
          `✅ **${goal.name}**\n` +
          `   💰 ${formattedCurrent} / ${formattedTarget} (${progress.toFixed(0)}%)\n` +
          `   📅 Selesai: ${formattedCompleted}\n` +
          `   📂 Kategori: ${goal.category || 'general'}\n` +
          `   📦 Status: Diarsipkan`
        );
      });
    } else if (activeGoals.length > 0) {
      listMessages.push(`\n📈 **Goal Aktif:**`);
      activeGoals.forEach((goal, index) => {
        const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
        const formattedCurrent = formatCurrency(goal.currentAmount, userPreferences?.defaultCurrency);
        const formattedTarget = formatCurrency(goal.targetAmount, userPreferences?.defaultCurrency);
        const deadline = new Date(goal.deadline * 1000);
        const formattedDeadline = deadline.toLocaleDateString('id-ID', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        let statusIcon = '🟡';
        if (progress >= 100) statusIcon = '✅';
        else if (progress >= 75) statusIcon = '🟢';
        else if (progress >= 50) statusIcon = '🟡';
        else statusIcon = '🔴';

        listMessages.push(
          `${statusIcon} **${goal.name}**\n` +
          `   💰 ${formattedCurrent} / ${formattedTarget} (${progress.toFixed(0)}%)\n` +
          `   📅 Deadline: ${formattedDeadline}\n` +
          `   📂 Kategori: ${goal.category || 'general'}`
        );
      });
    }

    if (!includeArchived && completedGoals.length > 0) {
      listMessages.push(`\n🏆 **Goal Tercapai:** ${completedGoals.length} goal (ketik "daftar goal completed" untuk detail)`);
    }

    listMessages.push(
      `\n💡 *Tips:*\n` +
      `• Ketik "nabung 100000 untuk [nama goal]" untuk menabung\n` +
      `• Ketik "buat goal [nama] target [jumlah]" untuk goal baru\n` +
      `• Ketik "daftar goal completed" untuk lihat arsip\n` +
      `• Ketik "cek tabungan" untuk melihat ringkasan tabungan`
    );

    return listMessages.join('\n');

  } catch (error) {
    console.error('Error getting goals list:', error);
    return `❌ Gagal mengambil daftar goal`;
  }
};

// Helper function to handle goal deletion with fund transfer
const handleGoalDeletion = async (
  userId: string,
  goalToDelete: any,
  userPreferences: any,
  allGoals: any[]
) => {
  try {
    const { storage } = await import('./storage');

    // If goal has saved money, offer transfer options
    if (goalToDelete.currentAmount > 0) {
      const formattedAmount = formatCurrency(goalToDelete.currentAmount, userPreferences?.defaultCurrency);
      const otherActiveGoals = allGoals.filter(g =>
        g.id !== goalToDelete.id &&
        g.isActive &&
        g.currentAmount < g.targetAmount
      );

      if (otherActiveGoals.length > 0) {
        // Suggest transferring to another goal
        const goalOptions = otherActiveGoals.slice(0, 3).map(g =>
          `• ${g.name} (${formatCurrency(g.currentAmount, userPreferences?.defaultCurrency)}/${formatCurrency(g.targetAmount, userPreferences?.defaultCurrency)})`
        ).join('\n');

        return {
          success: false,
          message: `💰 *Dana Perlu Ditransfer*\n\n` +
            `Goal "${goalToDelete.name}" memiliki tabungan ${formattedAmount}.\n\n` +
            `🔄 *Opsi Transfer:*\n` +
            `${goalOptions}\n\n` +
            `💡 *Cara Transfer:*\n` +
            `• "transfer ${formattedAmount} dari ${goalToDelete.name} ke [nama goal lain]"\n` +
            `• "kembalikan dana ${goalToDelete.name} ke saldo"\n\n` +
            `⚠️ Transfer dana terlebih dahulu sebelum menghapus goal.`
        };
      } else {
        // No other goals, create refund transaction
        await createRefundTransaction(userId, goalToDelete, userPreferences);

        // Now safe to delete the goal
        await storage.deleteGoal(goalToDelete.id);

        return {
          success: true,
          message: `✅ *Goal Berhasil Dihapus*\n\n` +
            `📂 Goal: ${goalToDelete.name}\n` +
            `💰 Dana ${formattedAmount} telah dikembalikan ke saldo Anda\n\n` +
            `📊 Transaksi pengembalian dana telah dicatat secara otomatis.`
        };
      }
    } else {
      // No money saved, safe to delete
      await storage.deleteGoal(goalToDelete.id);

      return {
        success: true,
        message: `✅ *Goal Berhasil Dihapus*\n\n` +
          `📂 Goal: ${goalToDelete.name}\n\n` +
          `_Goal telah dihapus dari sistem_`
      };
    }

  } catch (error) {
    console.error('Error handling goal deletion:', error);
    return {
      success: false,
      message: 'Gagal menghapus goal'
    };
  }
};

// Helper function to create refund transaction when goal is deleted
const createRefundTransaction = async (userId: string, goal: any, userPreferences: any) => {
  try {
    const { storage } = await import('./storage');

    // Get or create "Goal Refund" income category
    const categories = await storage.getCategories(userId);
    let refundCategory = categories.find(c =>
      c.name.toLowerCase() === "goal refund" || c.name.toLowerCase() === "pengembalian goal"
    );

    if (!refundCategory) {
      refundCategory = await storage.createCategory({
        userId,
        name: "Pengembalian Goal",
        type: "income",
        icon: "🔄",
        color: "#10B981"
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Create income transaction for the refund
    await storage.createTransaction({
      userId,
      amount: goal.currentAmount,
      description: `Pengembalian dana dari goal: ${goal.name}`,
      categoryId: refundCategory.id,
      type: "income",
      date: now,
      currency: userPreferences?.defaultCurrency || "USD"
    });

    console.log(`Refund transaction created: ${goal.currentAmount} from goal ${goal.name}`);

  } catch (error) {
    console.error('Error creating refund transaction:', error);
    throw error;
  }
};
const getGoalsBalance = async (userId: string, userPreferences: any) => {
  try {
    const { storage } = await import('./storage');

    const goals = await storage.getGoals(userId);

    if (!goals || goals.length === 0) {
      return `💰 *Ringkasan Tabungan*\n\n` +
        `Anda belum memiliki goal keuangan.\n\n` +
        `Mulai menabung dengan membuat goal:\n` +
        `"buat goal emergency fund target 10 juta"`;
    }

    let totalSaved = 0;
    let totalTarget = 0;
    let activeGoals = 0;
    let completedGoals = 0;

    goals.forEach(goal => {
      totalSaved += goal.currentAmount;
      totalTarget += goal.targetAmount;

      if (goal.currentAmount >= goal.targetAmount) {
        completedGoals++;
      } else if (goal.isActive) {
        activeGoals++;
      }
    });

    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    const formattedSaved = formatCurrency(totalSaved, userPreferences?.defaultCurrency);
    const formattedTarget = formatCurrency(totalTarget, userPreferences?.defaultCurrency);
    const formattedRemaining = formatCurrency(Math.max(totalTarget - totalSaved, 0), userPreferences?.defaultCurrency);

    let balanceMessages = [
      `💰 *Ringkasan Tabungan Anda*\n`,
      `💵 Total Terkumpul: ${formattedSaved}`,
      `🎯 Total Target: ${formattedTarget}`,
      `📊 Progress Keseluruhan: ${overallProgress.toFixed(1)}%`,
      `📈 Sisa Target: ${formattedRemaining}\n`,
      `📋 **Status Goal:**`,
      `🏆 Goal Tercapai: ${completedGoals}`,
      `📈 Goal Aktif: ${activeGoals}`,
      `📊 Total Goal: ${goals.length}`
    ];

    // Show top 3 goals by progress
    const sortedGoals = goals
      .filter(g => g.isActive && g.currentAmount < g.targetAmount)
      .sort((a, b) => (b.currentAmount / b.targetAmount) - (a.currentAmount / a.targetAmount))
      .slice(0, 3);

    if (sortedGoals.length > 0) {
      balanceMessages.push(`\n🔝 **Goal Teratas:**`);
      sortedGoals.forEach(goal => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        const formattedCurrent = formatCurrency(goal.currentAmount, userPreferences?.defaultCurrency);
        const formattedGoalTarget = formatCurrency(goal.targetAmount, userPreferences?.defaultCurrency);

        balanceMessages.push(
          `• ${goal.name}: ${formattedCurrent}/${formattedGoalTarget} (${progress.toFixed(0)}%)`
        );
      });
    }

    balanceMessages.push(
      `\n💡 *Mulai nabung:*\n` +
      `"nabung 100000 untuk [nama goal]"`
    );

    return balanceMessages.join('\n');

  } catch (error) {
    console.error('Error getting goals balance:', error);
    return `❌ Gagal mengambil ringkasan tabungan`;
  }
};

// Helper function to get category list
const getCategoryList = async (userId: string, userPreferences: any) => {
  try {
    const { storage } = await import('./storage');

    const categories = await storage.getCategories(userId);

    if (!categories || categories.length === 0) {
      return `📋 *Daftar Kategori*\n\n` +
        `Anda belum memiliki kategori kustom.\n\n` +
        `Buat kategori baru dengan:\n` +
        `• "buat kategori Kopi ☕ #8B4513"\n` +
        `• "tambah kategori Investasi 💰 #00C851 income"`;
    }

    let listMessages = [`📋 *Daftar Kategori Anda*\n`];

    // Group by type
    const expenseCategories = categories.filter(c => c.type === 'expense');
    const incomeCategories = categories.filter(c => c.type === 'income');

    if (expenseCategories.length > 0) {
      listMessages.push(`\n📤 **Pengeluaran:**`);
      expenseCategories.forEach((category, index) => {
        const defaultLabel = category.isDefault ? ' (Default)' : '';
        listMessages.push(
          `${index + 1}. ${category.icon} **${category.name}**${defaultLabel}\n` +
          `   🎨 Warna: ${category.color}`
        );
      });
    }

    if (incomeCategories.length > 0) {
      listMessages.push(`\n📥 **Pemasukan:**`);
      incomeCategories.forEach((category, index) => {
        const defaultLabel = category.isDefault ? ' (Default)' : '';
        listMessages.push(
          `${index + 1}. ${category.icon} **${category.name}**${defaultLabel}\n` +
          `   🎨 Warna: ${category.color}`
        );
      });
    }

    listMessages.push(
      `\n💡 *Tips:*\n` +
      `• Ketik "buat kategori [nama] [emoji] [warna]" untuk buat baru\n` +
      `• Ketik "ubah kategori [lama] menjadi [baru]" untuk ubah nama\n` +
      `• Ketik "hapus kategori [nama]" untuk hapus (jika tidak ada transaksi)`
    );

    return listMessages.join('\n');

  } catch (error) {
    console.error('Error getting category list:', error);
    return `❌ Gagal mengambil daftar kategori`;
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
