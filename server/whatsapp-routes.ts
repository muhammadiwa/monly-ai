import express from 'express';
import { Response } from 'express';
import { 
  initializeUserWhatsAppClient, 
  getConnectionState,
  disconnectUserWhatsApp,
  registerMessageHandlers
} from './whatsapp-service';
import { requireAuth, AuthRequest } from './auth';

const router = express.Router();

// Get WhatsApp connection status for current user
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
        status: 'disconnected'
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
      connected: false,
      status: 'error',
      message: 'Failed to get WhatsApp status'
    });
  }
});

// Generate QR code for WhatsApp Web connection
router.post('/whatsapp/connect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const result = await initializeUserWhatsAppClient(userId);
    res.json(result);
  } catch (error) {
    console.error('Error generating WhatsApp QR code:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to generate WhatsApp QR code'
    });
  }
});

// Disconnect WhatsApp Web
router.post('/whatsapp/disconnect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const result = await disconnectUserWhatsApp(userId);
    res.json(result);
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect WhatsApp'
    });
  }
});

// Reconnect WhatsApp Web
router.post('/whatsapp/reconnect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { reconnectWhatsAppClient } = await import('./whatsapp-service');
    const result = await reconnectWhatsAppClient(userId);
    res.json(result);
  } catch (error) {
    console.error('Error reconnecting WhatsApp:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to reconnect WhatsApp'
    });
  }
});

// Initialize message handlers
router.post('/whatsapp/init-handlers', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Check if user has an active connection
    const connectionState = getConnectionState(userId);
    if (!connectionState || connectionState.status !== 'ready') {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp client not ready. Please connect first.'
      });
    }

    const success = registerMessageHandlers(userId);
    
    if (success) {
      res.json({
        success: true,
        message: 'WhatsApp message handlers initialized'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'WhatsApp client not ready or not found'
      });
    }
  } catch (error) {
    console.error('Error initializing message handlers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize message handlers'
    });
  }
});

export default router;
