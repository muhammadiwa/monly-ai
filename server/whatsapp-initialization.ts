import { initializeUserWhatsAppClient, getAllConnections } from './whatsapp-service';
import { db } from './db';
import { whatsappIntegrations } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Initialize WhatsApp clients for all active integrations on server startup
 */
export const initializeAllWhatsAppClients = async () => {
  try {
    console.log('🤖 Initializing WhatsApp clients for active integrations...');
    
    // Get all active WhatsApp integrations
    const activeIntegrations = await db
      .select({
        userId: whatsappIntegrations.userId,
        whatsappNumber: whatsappIntegrations.whatsappNumber,
        displayName: whatsappIntegrations.displayName
      })
      .from(whatsappIntegrations)
      .where(eq(whatsappIntegrations.status, 'active'));

    console.log(`Found ${activeIntegrations.length} active WhatsApp integrations`);

    // Initialize clients for each unique user
    const uniqueUserIds = Array.from(new Set(activeIntegrations.map(i => i.userId)));
    
    for (const userId of uniqueUserIds) {
      try {
        console.log(`Initializing WhatsApp client for user ${userId}...`);
        
        // Don't wait for QR code, just initialize
        initializeUserWhatsAppClient(userId).then(result => {
          if (result.success) {
            console.log(`✅ WhatsApp client initialized for user ${userId}: ${result.status}`);
          } else {
            console.log(`❌ Failed to initialize WhatsApp client for user ${userId}: ${result.message}`);
          }
        }).catch(error => {
          console.error(`Error initializing WhatsApp client for user ${userId}:`, error);
        });
        
        // Small delay between initializations to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error initializing WhatsApp client for user ${userId}:`, error);
      }
    }
    
    console.log('🤖 WhatsApp client initialization process completed');
    
  } catch (error) {
    console.error('Error initializing WhatsApp clients:', error);
  }
};

/**
 * Get status of all WhatsApp connections
 */
export const getWhatsAppConnectionsStatus = () => {
  const connections = getAllConnections();
  
  return {
    totalConnections: connections.length,
    activeConnections: connections.filter(c => c.status === 'ready' || c.status === 'authenticated').length,
    connections: connections.map(c => ({
      userId: c.userId,
      status: c.status,
      hasQrCode: !!c.qrCode
    }))
  };
};

/**
 * Health check for WhatsApp service
 */
export const checkWhatsAppServiceHealth = () => {
  const status = getWhatsAppConnectionsStatus();
  
  return {
    healthy: true,
    message: `WhatsApp service running with ${status.activeConnections}/${status.totalConnections} active connections`,
    details: status
  };
};
