import { apiRequest } from './queryClient';

export interface WhatsAppConnection {
  id: number;
  userId: string;
  whatsappNumber: string;
  displayName?: string;
  activatedAt: number;
  status: 'active' | 'inactive';
  createdAt: number;
}

export interface WhatsAppActivationCode {
  id: number;
  userId: string;
  code: string;
  expiresAt: number;
  usedAt?: number;
  createdAt: number;
}

/**
 * Generate a new activation code
 */
export const generateActivationCode = async (): Promise<{
  success: boolean;
  code?: string;
  expiresAt?: number;
  message?: string;
}> => {
  try {
    const response = await apiRequest('POST', '/api/whatsapp/generate-code');
    if (!response.ok) {
      throw new Error('Failed to generate activation code');
    }
    return await response.json();
  } catch (error) {
    console.error('Error generating activation code:', error);
    return { success: false, message: 'Failed to generate activation code' };
  }
};

/**
 * Get user's WhatsApp connections
 */
export const getWhatsAppConnections = async (): Promise<{
  success: boolean;
  connections?: WhatsAppConnection[];
  message?: string;
}> => {
  try {
    const response = await apiRequest('GET', '/api/whatsapp/connections');
    if (!response.ok) {
      throw new Error('Failed to fetch WhatsApp connections');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching WhatsApp connections:', error);
    return { success: false, message: 'Failed to fetch WhatsApp connections' };
  }
};

/**
 * Get active activation codes
 */
export const getActiveActivationCodes = async (): Promise<{
  success: boolean;
  activeCodes?: WhatsAppActivationCode[];
  message?: string;
}> => {
  try {
    const response = await apiRequest('GET', '/api/whatsapp/active-codes');
    if (!response.ok) {
      throw new Error('Failed to fetch active codes');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching active codes:', error);
    return { success: false, message: 'Failed to fetch active codes' };
  }
};

/**
 * Disconnect a WhatsApp integration
 */
export const disconnectWhatsAppConnection = async (connectionId: number): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    const response = await apiRequest('DELETE', `/api/whatsapp/connections/${connectionId}`);
    if (!response.ok) {
      throw new Error('Failed to disconnect WhatsApp');
    }
    return await response.json();
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    return { success: false, message: 'Failed to disconnect WhatsApp' };
  }
};

/**
 * Format WhatsApp number for display
 */
export const formatWhatsAppNumber = (number: string): string => {
  // Remove any non-digit characters
  const cleaned = number.replace(/\D/g, '');
  
  // Add country code if missing
  if (cleaned.startsWith('8')) {
    return `+62${cleaned}`;
  } else if (cleaned.startsWith('62')) {
    return `+${cleaned}`;
  }
  
  return `+${cleaned}`;
};

/**
 * Get time remaining for activation code
 */
export const getTimeRemaining = (expiresAt: number): string => {
  const now = Date.now();
  const remaining = expiresAt - now;
  
  if (remaining <= 0) {
    return 'Expired';
  }
  
  const minutes = Math.floor(remaining / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};
