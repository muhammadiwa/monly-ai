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
    console.log('📱 Current bot status:', currentStatus);
    
    // If bot is already connected (ready or authenticated), return success immediately
    if (currentStatus.connected && (currentStatus.status === 'ready' || currentStatus.status === 'authenticated')) {
      console.log('✅ Bot already connected, returning status');
      return res.json({
        success: true,
        status: currentStatus.status,
        message: 'WhatsApp Bot is already connected and ready'
      });
    }

    // If we have a QR code ready for scanning, return it
    if (currentStatus.status === 'qr_received' && currentStatus.qrCode) {
      console.log('📱 QR code available, returning it');
      return res.json({
        success: true,
        status: currentStatus.status,
        qrCode: currentStatus.qrCode,
        message: 'QR code available for scanning'
      });
    }

    // Bot is disconnected or not initialized, try to start/reconnect
    if (currentStatus.status === 'disconnected') {
      console.log('🔄 Bot disconnected, attempting reconnection...');
      const result = await reconnectSingleWhatsAppBot();
      
      // Return success for both authenticated and QR code scenarios
      if (result.success || result.qrCode) {
        console.log('✅ Reconnection result:', result);
        res.json(result);
      } else {
        // Even if reconnect "failed", try to generate new QR code
        console.log('🔄 Reconnect failed, attempting fresh initialization...');
        initializeSingleWhatsAppBot();
        
        // Wait for QR code generation
        setTimeout(async () => {
          const newStatus = getSingleBotConnectionState();
          console.log('📱 Fresh init result:', newStatus);
          res.json({
            success: !!newStatus.qrCode,
            status: newStatus.status,
            qrCode: newStatus.qrCode,
            message: newStatus.qrCode ? 'New QR code generated after reconnection failure' : 'Failed to generate QR code'
          });
        }, 3000); // Wait 3 seconds for QR generation
      }
    } else {
      // Bot is in some other state (initializing, authenticating, etc.)
      console.log('🔄 Bot in transitional state, initializing...');
      initializeSingleWhatsAppBot();
      
      // Wait a bit and return status
      setTimeout(() => {
        const newStatus = getSingleBotConnectionState();
        console.log('📱 Init result:', newStatus);
        res.json({
          success: !!newStatus.qrCode || (newStatus.status !== 'disconnected'),
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
