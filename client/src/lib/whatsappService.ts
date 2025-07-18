import { apiRequest } from './queryClient';

export interface WhatsAppStatus {
  connected: boolean;
  status: 'ready' | 'authenticated' | 'qr_received' | 'initializing' | 'disconnected' | 'error';
  qrCode?: string;
}

/**
 * Get the current WhatsApp connection status
 */
export const getWhatsAppStatus = async (): Promise<WhatsAppStatus> => {
  try {
    const response = await apiRequest('GET', '/api/whatsapp/status');
    if (!response.ok) {
      throw new Error('Failed to fetch WhatsApp status');
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    return { connected: false, status: 'error' };
  }
};

/**
 * Generate a QR code for WhatsApp Web connection
 */
export const generateWhatsAppQR = async (): Promise<{ success: boolean; qrCode?: string; status: string; message?: string }> => {
  try {
    const response = await apiRequest('POST', '/api/whatsapp/connect');
    if (!response.ok) {
      throw new Error('Failed to generate QR code');
    }
    return await response.json();
  } catch (error) {
    console.error('Error generating WhatsApp QR:', error);
    return { success: false, status: 'error', message: 'Failed to generate QR code' };
  }
};

/**
 * Check the status of a QR code generation request
 */
export const checkWhatsAppQR = async (): Promise<{ success: boolean; qrCode?: string; status: string; connected?: boolean }> => {
  try {
    // Since we're now using the status endpoint directly, just use that
    const statusResponse = await getWhatsAppStatus();
    
    return { 
      success: true,
      status: statusResponse.status,
      qrCode: statusResponse.qrCode,
      connected: statusResponse.connected
    };
  } catch (error) {
    console.error('Error checking WhatsApp QR status:', error);
    return { success: false, status: 'error' };
  }
};

/**
 * Disconnect WhatsApp Web
 */
export const disconnectWhatsApp = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiRequest('POST', '/api/whatsapp/disconnect');
    if (!response.ok) {
      throw new Error('Failed to disconnect WhatsApp');
    }
    return await response.json();
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    return { success: false, message: 'Failed to disconnect WhatsApp' };
  }
};
