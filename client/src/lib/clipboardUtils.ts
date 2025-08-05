/**
 * Universal clipboard copy utility for production environments
 * Handles HTTPS/HTTP, different browsers, and provides fallbacks
 */

export interface CopyResult {
  success: boolean;
  method: 'clipboard-api' | 'execCommand' | 'textarea-select' | 'manual-fallback';
  error?: string;
  debug?: string;
}

export const copyToClipboard = async (text: string): Promise<CopyResult> => {
  const debugInfo: string[] = [];
  
  debugInfo.push(`isSecureContext: ${window.isSecureContext}`);
  debugInfo.push(`hasClipboard: ${!!navigator.clipboard}`);
  debugInfo.push(`protocol: ${window.location.protocol}`);
  debugInfo.push(`userAgent: ${navigator.userAgent.substring(0, 50)}...`);

  try {
    // Method 1: Modern Clipboard API (works in HTTPS and secure contexts)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return {
          success: true,
          method: 'clipboard-api',
          debug: debugInfo.join('; ')
        };
      } catch (clipboardError) {
        debugInfo.push(`clipboard-api-error: ${clipboardError}`);
        // Fall through to next method
      }
    }
    
    // Method 2: execCommand approach with better error handling
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      
      // Ensure the textarea is styled to be invisible but functional
      Object.assign(textArea.style, {
        position: 'fixed',
        left: '-9999px',
        top: '50%',
        width: '2em',
        height: '2em',
        padding: '0',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        background: 'transparent',
        fontSize: '16px', // Prevent zoom on iOS
        opacity: '0',
        zIndex: '-1'
      });
      
      document.body.appendChild(textArea);
      
      // Focus and select with better mobile support
      textArea.focus();
      textArea.select();
      
      // Multiple selection attempts for different browsers
      if (textArea.setSelectionRange) {
        textArea.setSelectionRange(0, text.length);
      }
      
      // Check if text is actually selected
      const selectedText = window.getSelection()?.toString() || textArea.value.substring(textArea.selectionStart || 0, textArea.selectionEnd || 0);
      debugInfo.push(`selectedText: ${selectedText.length} chars`);
      
      // @ts-ignore - deprecated but still works in many browsers
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        return {
          success: true,
          method: 'execCommand',
          debug: debugInfo.join('; ')
        };
      } else {
        debugInfo.push('execCommand returned false');
      }
    } catch (execError) {
      debugInfo.push(`execCommand-error: ${execError}`);
    }
    
    // Method 3: Manual selection approach
    try {
      const range = document.createRange();
      const selection = window.getSelection();
      
      // Create a span with the text
      const span = document.createElement('span');
      span.textContent = text;
      span.style.position = 'fixed';
      span.style.left = '50%';
      span.style.top = '50%';
      span.style.transform = 'translate(-50%, -50%)';
      span.style.padding = '10px';
      span.style.background = 'white';
      span.style.border = '1px solid #ccc';
      span.style.zIndex = '9999';
      
      document.body.appendChild(span);
      
        if (selection) {
          selection.removeAllRanges();
          range.selectNodeContents(span);
          selection.addRange(range);
          
          // @ts-ignore - deprecated but still works in many browsers
          const copySuccess = document.execCommand('copy');
          selection.removeAllRanges();
          
          // Keep the span visible briefly so user can see the selection
        setTimeout(() => {
          if (span.parentNode) {
            span.parentNode.removeChild(span);
          }
        }, 100);
        
        if (copySuccess) {
          return {
            success: true,
            method: 'textarea-select',
            debug: debugInfo.join('; ')
          };
        }
      }
      
      // If copy failed but span is still there, remove it
      if (span.parentNode) {
        span.parentNode.removeChild(span);
      }
      
    } catch (selectionError) {
      debugInfo.push(`selection-error: ${selectionError}`);
    }
    
    // All methods failed
    throw new Error('All clipboard methods failed');
    
  } catch (error) {
    return {
      success: false,
      method: 'manual-fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: debugInfo.join('; ')
    };
  }
};

/**
 * Copy WhatsApp activation code with proper formatting and force copy option
 */
export const copyActivationCode = async (code: string, forceMethod?: 'clipboard-api' | 'execCommand' | 'textarea-select'): Promise<CopyResult> => {
  const formattedText = `AKTIVASI: ${code}`;
  
  if (forceMethod) {
    return await forceClipboardMethod(formattedText, forceMethod);
  }
  
  return await copyToClipboard(formattedText);
};

/**
 * Force a specific clipboard method for testing
 */
export const forceClipboardMethod = async (text: string, method: 'clipboard-api' | 'execCommand' | 'textarea-select'): Promise<CopyResult> => {
  const debugInfo: string[] = [`forcedMethod: ${method}`];
  
  try {
    switch (method) {
      case 'clipboard-api': {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          return { success: true, method: 'clipboard-api', debug: debugInfo.join('; ') };
        } else {
          throw new Error('Clipboard API not available');
        }
      }
        
      case 'execCommand': {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        Object.assign(textArea.style, {
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '300px',
          height: '100px',
          padding: '10px',
          border: '2px solid #007bff',
          background: 'white',
          fontSize: '16px',
          zIndex: '10000'
        });
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        // Show for a moment so user can see it
        setTimeout(() => {
          // @ts-ignore - deprecated but still works in many browsers
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (!successful) {
            throw new Error('execCommand failed');
          }
        }, 500);
        
        return { success: true, method: 'execCommand', debug: debugInfo.join('; ') };
      }
        
      case 'textarea-select': {
        const div = document.createElement('div');
        div.innerHTML = `
          <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                      background: white; border: 2px solid #007bff; padding: 20px; 
                      border-radius: 8px; z-index: 10000; max-width: 90%; 
                      box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <h3 style="margin: 0 0 10px 0; color: #007bff;">Salin Kode Aktivasi</h3>
            <p style="margin: 0 0 10px 0; font-size: 14px;">Pilih text di bawah dan copy (Ctrl+C):</p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; 
                        font-family: monospace; font-size: 16px; user-select: all;
                        border: 1px dashed #007bff;" 
                 onclick="this.select(); document.execCommand('selectAll');">${text}</div>
            <div style="margin-top: 15px; text-align: right;">
              <button onclick="this.closest('div').remove();" 
                      style="background: #007bff; color: white; border: none; 
                             padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                Selesai
              </button>
            </div>
          </div>
        `;
        
        document.body.appendChild(div);
        
        // Auto-select the text
        const codeDiv = div.querySelector('div[onclick]') as HTMLElement;
        if (codeDiv) {
          const range = document.createRange();
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            range.selectNodeContents(codeDiv);
            selection.addRange(range);
          }
        }
        
        return { success: true, method: 'textarea-select', debug: debugInfo.join('; ') };
      }
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      success: false,
      method: method,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: debugInfo.join('; ')
    };
  }
};

/**
 * Check if clipboard is available in current environment
 */
export const isClipboardAvailable = (): boolean => {
  return !!(
    (navigator.clipboard && window.isSecureContext) ||
    // @ts-ignore - deprecated but still works
    document.queryCommandSupported?.('copy')
  );
};

/**
 * Get user-friendly message for clipboard status
 */
export const getClipboardStatusMessage = (): string => {
  if (navigator.clipboard && window.isSecureContext) {
    return 'Clipboard tersedia (Secure context)';
  } else if (
    // @ts-ignore - deprecated but still works
    document.queryCommandSupported?.('copy')
  ) {
    return 'Clipboard tersedia (Legacy mode)';
  } else {
    return 'Clipboard tidak tersedia - perlu copy manual';
  }
};
