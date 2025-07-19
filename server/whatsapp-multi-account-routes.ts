import express from 'express';
import { Response } from 'express';
import { requireAuth, AuthRequest } from './auth';
import { db } from './db';
import { whatsappIntegrations, whatsappActivationCodes } from '@shared/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { 
  initializeUserWhatsAppClient, 
  disconnectUserWhatsApp, 
  getConnectionState,
  sendWhatsAppMessage 
} from './whatsapp-service';
import { 
  getWhatsAppConnectionsStatus,
  checkWhatsAppServiceHealth
} from './whatsapp-initialization';

const router = express.Router();

// Generate activation code
router.post('/whatsapp/generate-code', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Generate random 6-character code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Set expiry time (5 minutes from now)
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
    
    // Insert activation code into database
    await db.insert(whatsappActivationCodes).values({
      userId,
      code,
      expiresAt,
      createdAt: Date.now(),
    });

    res.json({
      success: true,
      code,
      expiresAt,
      message: 'Activation code generated successfully'
    });
  } catch (error) {
    console.error('Error generating activation code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate activation code'
    });
  }
});

// Activate WhatsApp integration (called by WhatsApp bot)
router.post('/whatsapp/activate', async (req, res: Response) => {
  try {
    const { code, whatsapp_number, name } = req.body;

    if (!code || !whatsapp_number) {
      return res.status(400).json({
        success: false,
        message: 'Code and WhatsApp number are required'
      });
    }

    // Find the activation code
    const activationCode = await db
      .select()
      .from(whatsappActivationCodes)
      .where(
        and(
          eq(whatsappActivationCodes.code, code),
          gt(whatsappActivationCodes.expiresAt, Date.now()), // Not expired
          isNull(whatsappActivationCodes.usedAt) // Not used
        )
      )
      .limit(1);

    if (activationCode.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired activation code'
      });
    }

    const codeData = activationCode[0];

    // Check if this WhatsApp number is already connected to this user
    const existingIntegration = await db
      .select()
      .from(whatsappIntegrations)
      .where(
        and(
          eq(whatsappIntegrations.userId, codeData.userId),
          eq(whatsappIntegrations.whatsappNumber, whatsapp_number)
        )
      )
      .limit(1);

    if (existingIntegration.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This WhatsApp number is already connected to your account'
      });
    }

    // Mark the code as used
    await db
      .update(whatsappActivationCodes)
      .set({ usedAt: Date.now() })
      .where(eq(whatsappActivationCodes.id, codeData.id));

    // Create WhatsApp integration
    await db.insert(whatsappIntegrations).values({
      userId: codeData.userId,
      whatsappNumber: whatsapp_number,
      displayName: name || null,
      activatedAt: Date.now(),
      status: 'active',
      createdAt: Date.now(),
    });

    res.json({
      success: true,
      message: 'WhatsApp account successfully connected to Monly AI'
    });
  } catch (error) {
    console.error('Error activating WhatsApp integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate WhatsApp integration'
    });
  }
});

// Get user's WhatsApp connections
router.get('/whatsapp/connections', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const connections = await db
      .select()
      .from(whatsappIntegrations)
      .where(eq(whatsappIntegrations.userId, userId))
      .orderBy(whatsappIntegrations.createdAt);

    res.json({
      success: true,
      connections
    });
  } catch (error) {
    console.error('Error fetching WhatsApp connections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch WhatsApp connections'
    });
  }
});

// Get active activation codes
router.get('/whatsapp/active-codes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const activeCodes = await db
      .select()
      .from(whatsappActivationCodes)
      .where(
        and(
          eq(whatsappActivationCodes.userId, userId),
          gt(whatsappActivationCodes.expiresAt, Date.now()), // Not expired
          isNull(whatsappActivationCodes.usedAt) // Not used
        )
      )
      .orderBy(whatsappActivationCodes.createdAt);

    res.json({
      success: true,
      activeCodes
    });
  } catch (error) {
    console.error('Error fetching active codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active codes'
    });
  }
});

// Disconnect WhatsApp integration
router.delete('/whatsapp/connections/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const connectionId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (!connectionId) {
      return res.status(400).json({ success: false, message: 'Invalid connection ID' });
    }

    // First get the connection details
    const connection = await db
      .select()
      .from(whatsappIntegrations)
      .where(
        and(
          eq(whatsappIntegrations.id, connectionId),
          eq(whatsappIntegrations.userId, userId)
        )
      )
      .limit(1);

    if (connection.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'WhatsApp connection not found' 
      });
    }

    // Disconnect the WhatsApp client if it's active
    await disconnectUserWhatsApp(userId);

    // Delete the integration from database
    await db
      .delete(whatsappIntegrations)
      .where(
        and(
          eq(whatsappIntegrations.id, connectionId),
          eq(whatsappIntegrations.userId, userId)
        )
      );

    res.json({
      success: true,
      message: 'WhatsApp connection removed successfully'
    });
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect WhatsApp'
    });
  }
});

// Initialize WhatsApp client for user
router.post('/whatsapp/initialize', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Check if user has any WhatsApp integrations
    const integrations = await db
      .select()
      .from(whatsappIntegrations)
      .where(eq(whatsappIntegrations.userId, userId))
      .limit(1);

    if (integrations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No WhatsApp integration found. Please connect your WhatsApp first.'
      });
    }

    // Initialize WhatsApp client
    const result = await initializeUserWhatsAppClient(userId);
    
    res.json(result);
  } catch (error) {
    console.error('Error initializing WhatsApp client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize WhatsApp client'
    });
  }
});

// Get WhatsApp client status
router.get('/whatsapp/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const connectionState = getConnectionState(userId);
    
    if (!connectionState) {
      return res.json({
        connected: false,
        status: 'disconnected',
        message: 'No active WhatsApp connection'
      });
    }

    res.json({
      connected: connectionState.status === 'ready' || connectionState.status === 'authenticated',
      status: connectionState.status,
      qrCode: connectionState.qrCode
    });
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get WhatsApp status'
    });
  }
});

// Send test message (for testing purposes)
router.post('/whatsapp/send-test', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { message, whatsappNumber } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (!message || !whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: 'Message and WhatsApp number are required'
      });
    }

    // Check if the WhatsApp number belongs to the user
    const integration = await db
      .select()
      .from(whatsappIntegrations)
      .where(
        and(
          eq(whatsappIntegrations.userId, userId),
          eq(whatsappIntegrations.whatsappNumber, whatsappNumber)
        )
      )
      .limit(1);

    if (integration.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'WhatsApp number not connected to your account'
      });
    }

    const result = await sendWhatsAppMessage(userId, whatsappNumber, message);
    res.json(result);
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test message'
    });
  }
});

// Get WhatsApp service health status
router.get('/whatsapp/health', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const health = checkWhatsAppServiceHealth();
    res.json(health);
  } catch (error) {
    console.error('Error checking WhatsApp service health:', error);
    res.status(500).json({
      healthy: false,
      message: 'Failed to check service health',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all connections status (admin endpoint)
router.get('/whatsapp/connections-status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const status = getWhatsAppConnectionsStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting connections status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get connections status'
    });
  }
});

export default router;
