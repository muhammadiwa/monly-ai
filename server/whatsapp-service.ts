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
        // Call activation API
        const response = await fetch('/api/whatsapp/activate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            whatsapp_number: whatsappNumber,
            name: message._data.notifyName || null, // Optional: WhatsApp display name
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          await message.reply('✅ Akun WhatsApp Anda telah berhasil terhubung ke Monly AI.');
        } else {
          await message.reply(`❌ ${result.message || 'Kode aktivasi tidak valid atau sudah kadaluarsa.'}`);
        }
      } catch (error) {
        console.error('Error processing activation:', error);
        await message.reply('❌ Terjadi kesalahan saat memproses aktivasi. Silakan coba lagi.');
      }
    }
    // Simple expense tracking pattern: "spent $X on Y"
    else if (message.body.match(/spent\s+[$£€]?(\d+(?:\.\d+)?)\s+(?:on|for)\s+(.*)/i)) {
      const expensePattern = /spent\s+[$£€]?(\d+(?:\.\d+)?)\s+(?:on|for)\s+(.*)/i;
      const expenseMatch = RegExp.prototype.exec.call(expensePattern, message.body);

      if (expenseMatch) {
        const amount = parseFloat(expenseMatch[1]);
        const category = expenseMatch[2].trim();
        
        // Here you would integrate with your expense tracking system
        // For example: trackExpense(userId, amount, category);
        
        await message.reply(`✅ Recorded expense: ${amount} for ${category}`);
      }
    } 
    // Simple balance inquiry
    else if (message.body.toLowerCase().includes('balance') || message.body.toLowerCase() === 'saldo') {
      // Here you would fetch the actual balance
      // For example: const balance = await getBalance(userId);
      
      await message.reply(`💰 Your current balance: $1,234.56`);
    }
    // Help command
    else if (message.body.toLowerCase() === 'help' || message.body.toLowerCase() === 'bantuan') {
      await message.reply(
        "🤖 *Monly AI Bot Commands*\n\n" +
        "- 'AKTIVASI: [KODE]' - Hubungkan WhatsApp ke akun\n" +
        "- 'spent $X on Y' - Track an expense\n" +
        "- 'balance' - Check your balance\n" +
        "- 'help' - Show this help message"
      );
    }
  });

  return true;
};
