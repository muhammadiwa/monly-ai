import express from 'express';
import { Response } from 'express';
import { requireAuth, AuthRequest } from './auth';
import { 
  initializeSingleWhatsAppBot,
  reconnectSingleWhatsAppBot,
  getSingleBotConnectionState,
  sendSingleBotMessage,
  disconnectSingleWhatsAppBot
} from './whatsapp-single-bot';

const router = express.Router();

// Get WhatsApp Bot status
router.get('/whatsapp/status', async (req, res: Response) => {
  try {
    const status = getSingleBotConnectionState();
    res.json(status);
  } catch (error) {
    console.error('Error getting WhatsApp Bot status:', error);
    res.status(500).json({
      connected: false,
      status: 'error',
      message: 'Failed to get WhatsApp Bot status'
    });
  }
});

// Connect/Initialize WhatsApp Bot
router.post('/whatsapp/connect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Check current status
    const currentStatus = getSingleBotConnectionState();
    
    if (currentStatus.connected) {
      return res.json({
        success: true,
        status: currentStatus.status,
        message: 'WhatsApp Bot already connected'
      });
    }

    if (currentStatus.status === 'qr_received' && currentStatus.qrCode) {
      return res.json({
        success: true,
        status: currentStatus.status,
        qrCode: currentStatus.qrCode,
        message: 'QR code available for scanning'
      });
    }

    // Try to initialize or reconnect
    if (currentStatus.status === 'disconnected') {
      const result = await reconnectSingleWhatsAppBot();
      res.json(result);
    } else {
      // Initialize for the first time
      initializeSingleWhatsAppBot();
      
      // Wait a bit and return status
      setTimeout(() => {
        const newStatus = getSingleBotConnectionState();
        res.json({
          success: newStatus.status !== 'disconnected',
          status: newStatus.status,
          qrCode: newStatus.qrCode,
          message: newStatus.status === 'qr_received' ? 'QR code generated' : 'Bot initialization started'
        });
      }, 2000);
    }
  } catch (error) {
    console.error('Error connecting WhatsApp Bot:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to connect WhatsApp Bot'
    });
  }
});

// Disconnect WhatsApp Bot
router.post('/whatsapp/disconnect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const result = await disconnectSingleWhatsAppBot();
    res.json(result);
  } catch (error) {
    console.error('Error disconnecting WhatsApp Bot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect WhatsApp Bot'
    });
  }
});

// Reconnect WhatsApp Bot
router.post('/whatsapp/reconnect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const result = await reconnectSingleWhatsAppBot();
    res.json(result);
  } catch (error) {
    console.error('Error reconnecting WhatsApp Bot:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to reconnect WhatsApp Bot'
    });
  }
});

// Send test message (for admin testing)
router.post('/whatsapp/send-test', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { whatsappNumber, message } = req.body;
    
    if (!whatsappNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'WhatsApp number and message are required' 
      });
    }

    const result = await sendSingleBotMessage(whatsappNumber, message);
    res.json(result);
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test message'
    });
  }
});

export default router;
