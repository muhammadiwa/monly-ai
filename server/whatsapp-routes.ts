import express from 'express';
import { Response } from 'express';
import { 
  initializeWhatsAppClient, 
  getWhatsAppConnectionStatus,
  generateQRCode,
  disconnectWhatsApp,
  registerMessageHandlers
} from './whatsapp-service';
import { requireAuth, AuthRequest } from './auth';

const router = express.Router();

// Get WhatsApp connection status
router.get('/whatsapp/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const status = getWhatsAppConnectionStatus();
    res.json(status);
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
    const result = await generateQRCode();
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
    const result = await disconnectWhatsApp();
    res.json(result);
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect WhatsApp'
    });
  }
});

// Initialize message handlers
router.post('/whatsapp/init-handlers', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Use a default user ID for demo
    const success = registerMessageHandlers('default-user');
    
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
