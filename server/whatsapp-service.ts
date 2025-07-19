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
