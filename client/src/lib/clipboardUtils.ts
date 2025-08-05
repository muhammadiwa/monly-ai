/**
 * Universal clipboard copy utility for production environments
 * Handles HTTPS/HTTP, different browsers, and provides fallbacks
 */

export interface CopyResult {
  success: boolean;
  method: 'clipboard-api' | 'execCommand' | 'manual-fallback';
  error?: string;
}

export const copyToClipboard = async (text: string): Promise<CopyResult> => {
  try {
    // Method 1: Modern Clipboard API (works in HTTPS and secure contexts)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return {
        success: true,
        method: 'clipboard-api'
      };
    }
    
    // Method 2: Legacy execCommand (works in HTTP and older browsers)
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea invisible but still functional
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      return {
        success: true,
        method: 'execCommand'
      };
    } else {
      throw new Error('execCommand copy failed');
    }
    
  } catch (error) {
    // Method 3: Manual fallback
    return {
      success: false,
      method: 'manual-fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Copy WhatsApp activation code with proper formatting
 */
export const copyActivationCode = async (code: string): Promise<CopyResult> => {
  const formattedText = `AKTIVASI: ${code}`;
  return await copyToClipboard(formattedText);
};

/**
 * Check if clipboard is available in current environment
 */
export const isClipboardAvailable = (): boolean => {
  return !!(
    (navigator.clipboard && window.isSecureContext) ||
    document.queryCommandSupported?.('copy')
  );
};

/**
 * Get user-friendly message for clipboard status
 */
export const getClipboardStatusMessage = (): string => {
  if (navigator.clipboard && window.isSecureContext) {
    return 'Clipboard tersedia (Secure context)';
  } else if (document.queryCommandSupported?.('copy')) {
    return 'Clipboard tersedia (Legacy mode)';
  } else {
    return 'Clipboard tidak tersedia - perlu copy manual';
  }
};
