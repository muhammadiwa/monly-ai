import OpenAI from "openai";

// the newest OpenAI model is "gpt-4.1-nano" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "default_key"
});

// Helper function to get currency symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'IDR': 'Rp',
    'CNY': '¥',
    'KRW': '₩',
    'SGD': 'S$',
    'MYR': 'RM',
    'THB': '฿',
    'VND': '₫'
  };
  return symbols[currency] || currency;
}

// Helper function to parse Indonesian amount formats
function parseIndonesianAmount(text: string): number {
  // Remove common prefixes and normalize
  const cleanText = text.toLowerCase()
    .replace(/bayar|beli|transfer|gaji|biaya|pendaftaran|kuliah|sekolah|dari|untuk|ke|di|dengan/g, '')
    .trim();
  
  // Patterns for Indonesian amounts
  const patterns = [
    // "500rb", "500ribu" 
    /(\d+(?:[.,]\d+)?)\s*(?:rb|ribu)/i,
    // "2jt", "2juta"
    /(\d+(?:[.,]\d+)?)\s*(?:jt|juta)/i,
    // "1m", "1miliar"
    /(\d+(?:[.,]\d+)?)\s*(?:m|miliar)/i,
    // Plain numbers "500000"
    /(\d{3,})/
  ];
  
  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(',', '.'));
      
      if (pattern.source.includes('rb|ribu')) {
        return num * 1000;
      } else if (pattern.source.includes('jt|juta')) {
        return num * 1000000;
      } else if (pattern.source.includes('m|miliar')) {
        return num * 1000000000;
      } else {
        return num;
      }
    }
  }
  
  return 0;
}

export interface TransactionAnalysis {
  amount: number;
  description: string;
  category: string;
  type: "income" | "expense";
  confidence: number;
  date?: number; // Unix timestamp, optional - if not provided, use current date
  suggestedNewCategory?: {
    name: string;
    icon: string;
    color: string;
    type: "income" | "expense";
  };
}

export interface UserPreferences {
  defaultCurrency: string;
  language: string;
  autoCategorize: boolean;
}

export interface OCRResult {
  text: string;
  transactions: TransactionAnalysis[];
  confidence: number;
}

// Helper function to get timezone from environment
function getTimezone(): string {
  return process.env.TZ || 'Asia/Jakarta';
}

// Helper function to get current date info for AI context
function getCurrentDateContext(language: string = 'id'): string {
  const timezone = getTimezone();
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const dayOfWeek = now.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { 
    weekday: 'long',
    timeZone: timezone
  });
  const monthName = now.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { 
    month: 'long',
    timeZone: timezone
  });
  const year = now.getFullYear();
  const date = now.getDate();
  
  if (language === 'id') {
    return `Hari ini: ${dayOfWeek}, ${date} ${monthName} ${year} (${today}) - Timezone: ${timezone}`;
  } else {
    return `Today: ${dayOfWeek}, ${monthName} ${date}, ${year} (${today}) - Timezone: ${timezone}`;
  }
}

// Helper function to parse relative dates to Unix timestamp
function parseRelativeDate(text: string, language: string = 'id'): number | null {
  const timezone = getTimezone();
  
  // Get current date in the specific timezone
  const now = new Date();
  const utcNow = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const timezoneOffset = utcNow.getTime() - localNow.getTime();
  
  // Create today's date at midnight in the target timezone
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  console.log(`📅 Parsing relative date: "${text}" with timezone: ${timezone}`);
  console.log(`📅 Current time: ${now.toLocaleString('id-ID', { timeZone: timezone })}`);
  
  // Indonesian relative date patterns
  if (language === 'id') {
    if (/kemarin|yesterday/i.test(text)) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const timestamp = Math.floor(yesterday.getTime() / 1000);
      console.log(`📅 "kemarin" parsed as: ${timestamp} (${new Date(timestamp * 1000).toLocaleDateString('id-ID', { timeZone: timezone })})`);
      return timestamp;
    }
    
    if (/lusa|day after tomorrow/i.test(text)) {
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const timestamp = Math.floor(dayAfterTomorrow.getTime() / 1000);
      console.log(`📅 "lusa" parsed as: ${timestamp} (${new Date(timestamp * 1000).toLocaleDateString('id-ID', { timeZone: timezone })})`);
      return timestamp;
    }
    
    if (/besok|tomorrow/i.test(text)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const timestamp = Math.floor(tomorrow.getTime() / 1000);
      console.log(`📅 "besok" parsed as: ${timestamp} (${new Date(timestamp * 1000).toLocaleDateString('id-ID', { timeZone: timezone })})`);
      return timestamp;
    }
    
    // Pattern for "X hari yang lalu" or "X days ago"
    const daysAgoMatch = text.match(/(\d+)\s*(hari|days?)\s*(yang\s*)?(lalu|ago)/i);
    if (daysAgoMatch) {
      const daysAgo = parseInt(daysAgoMatch[1]);
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const timestamp = Math.floor(targetDate.getTime() / 1000);
      console.log(`📅 "${daysAgo} hari lalu" parsed as: ${timestamp} (${new Date(timestamp * 1000).toLocaleDateString('id-ID', { timeZone: timezone })})`);
      return timestamp;
    }
    
    // Pattern for "minggu lalu" or "last week"
    if (/minggu\s+(lalu|kemarin)|last\s+week/i.test(text)) {
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const timestamp = Math.floor(lastWeek.getTime() / 1000);
      console.log(`📅 "minggu lalu" parsed as: ${timestamp} (${new Date(timestamp * 1000).toLocaleDateString('id-ID', { timeZone: timezone })})`);
      return timestamp;
    }
  }
  
  // English relative date patterns  
  if (/yesterday/i.test(text)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const timestamp = Math.floor(yesterday.getTime() / 1000);
    console.log(`📅 "yesterday" parsed as: ${timestamp} (${new Date(timestamp * 1000).toLocaleDateString('en-US', { timeZone: timezone })})`);
    return timestamp;
  }
  
  if (/tomorrow/i.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const timestamp = Math.floor(tomorrow.getTime() / 1000);
    console.log(`📅 "tomorrow" parsed as: ${timestamp} (${new Date(timestamp * 1000).toLocaleDateString('en-US', { timeZone: timezone })})`);
    return timestamp;
  }
  
  const daysAgoMatch = text.match(/(\d+)\s*days?\s+ago/i);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1]);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() - daysAgo);
    const timestamp = Math.floor(targetDate.getTime() / 1000);
    console.log(`📅 "${daysAgo} days ago" parsed as: ${timestamp} (${new Date(timestamp * 1000).toLocaleDateString('en-US', { timeZone: timezone })})`);
    return timestamp;
  }
  
  if (/last\s+week/i.test(text)) {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const timestamp = Math.floor(lastWeek.getTime() / 1000);
    console.log(`📅 "last week" parsed as: ${timestamp} (${new Date(timestamp * 1000).toLocaleDateString('en-US', { timeZone: timezone })})`);
    return timestamp;
  }
  
  console.log(`📅 No relative date pattern found in: "${text}"`);
  return null;
}

// Helper function to parse specific dates to Unix timestamp
function parseSpecificDate(text: string, language: string = 'id'): number | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Indonesian month names
  const indonesianMonths: Record<string, number> = {
    'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
    'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
  };
  
  // English month names  
  const englishMonths: Record<string, number> = {
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
  };
  
  if (language === 'id') {
    // Pattern: "tanggal 15 juli" or "15 juli" or "15/7" or "15-7-2024"
    const datePatterns = [
      /(?:tanggal\s+)?(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?/i,
      /(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{4}))?/,
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        if (pattern.source.includes('januari|februari')) {
          // Named month format
          const day = parseInt(match[1]);
          const monthName = match[2].toLowerCase();
          const year = match[3] ? parseInt(match[3]) : currentYear;
          const monthIndex = indonesianMonths[monthName];
          
          if (monthIndex !== undefined && day >= 1 && day <= 31) {
            const date = new Date(year, monthIndex, day);
            return Math.floor(date.getTime() / 1000);
          }
        } else if (pattern.source.includes('(\\d{4})')) {
          // YYYY-MM-DD format
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // Month is 0-indexed
          const day = parseInt(match[3]);
          
          if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const date = new Date(year, month, day);
            return Math.floor(date.getTime() / 1000);
          }
        } else {
          // DD/MM or DD-MM format
          const day = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // Month is 0-indexed
          const year = match[3] ? parseInt(match[3]) : currentYear;
          
          if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const date = new Date(year, month, day);
            return Math.floor(date.getTime() / 1000);
          }
        }
      }
    }
  } else {
    // English date patterns
    const datePatterns = [
      /(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?/i,
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i,
      /(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{4}))?/,
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        if (pattern.source.includes('january|february')) {
          if (match[2] && !isNaN(parseInt(match[2]))) {
            // Month name first: "January 15"
            const monthName = match[1].toLowerCase();
            const day = parseInt(match[2]);
            const year = match[3] ? parseInt(match[3]) : currentYear;
            const monthIndex = englishMonths[monthName];
            
            if (monthIndex !== undefined && day >= 1 && day <= 31) {
              const date = new Date(year, monthIndex, day);
              return Math.floor(date.getTime() / 1000);
            }
          } else {
            // Day first: "15 January"
            const day = parseInt(match[1]);
            const monthName = match[2].toLowerCase();
            const year = match[3] ? parseInt(match[3]) : currentYear;
            const monthIndex = englishMonths[monthName];
            
            if (monthIndex !== undefined && day >= 1 && day <= 31) {
              const date = new Date(year, monthIndex, day);
              return Math.floor(date.getTime() / 1000);
            }
          }
        } else if (pattern.source.includes('(\\d{4})')) {
          // YYYY-MM-DD format
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          const day = parseInt(match[3]);
          
          if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const date = new Date(year, month, day);
            return Math.floor(date.getTime() / 1000);
          }
        } else {
          // DD/MM or MM/DD format (assuming DD/MM for international)
          const day = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          const year = match[3] ? parseInt(match[3]) : currentYear;
          
          if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const date = new Date(year, month, day);
            return Math.floor(date.getTime() / 1000);
          }
        }
      }
    }
  }
  
  return null;
}

export async function analyzeTransactionText(
  text: string, 
  availableCategories: any[] = [], 
  userPreferences?: UserPreferences
): Promise<TransactionAnalysis> {
  try {
    // Build categories list from database
    const categoryList = availableCategories.length > 0 
      ? availableCategories.map(cat => `- ${cat.name}${cat.type ? ` (${cat.type})` : ''}`).join('\n          ')
      : `- Food & Dining
          - Transportation
          - Shopping
          - Entertainment
          - Bills & Utilities
          - Healthcare
          - Education
          - Other
          - Salary (income)
          - Investment (income)
          - Freelance (income)`;

    // Set language and currency from preferences
    const language = userPreferences?.language === 'id' ? 'Indonesian' : 'English';
    const currency = userPreferences?.defaultCurrency || 'USD';
    const currencySymbol = getCurrencySymbol(currency);
    const autoCategorize = userPreferences?.autoCategorize ?? true;
    
    // Get current date context for AI
    const dateContext = getCurrentDateContext(language);

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `You are a financial transaction analyzer. Extract transaction details from user messages in ${language}.
          
          Available categories:
          ${categoryList}
          
          Currency: ${currency} (${currencySymbol})
          Auto-categorization: ${autoCategorize ? 'enabled' : 'disabled'}
          ${dateContext}
          
          IMPORTANT FORMATTING RULES:
          1. Respond in ${language}
          2. Format amounts in ${currency} currency
          3. Format description with proper title case
          4. Use proper capitalization for brand names
          5. Make descriptions clear and concise
          6. ALWAYS analyze for date information in the message
          
          AMOUNT PARSING RULES FOR INDONESIAN:
          - "rb" or "ribu" = thousand (×1,000)
          - "jt" or "juta" = million (×1,000,000)
          - "m" or "miliar" = billion (×1,000,000,000)
          - Examples: "500rb" = 500,000 | "2jt" = 2,000,000 | "1.5juta" = 1,500,000
          - NEVER interpret "rb" as millions - it's always thousands!
          
          DATE PARSING INSTRUCTIONS:
          - Look for date references like "kemarin" (yesterday), "tanggal 15 juli", "3 hari lalu", etc.
          - If NO date is mentioned, DO NOT include date field (will default to today)
          - If date IS mentioned, include "date" field with VALID Unix timestamp (seconds since epoch)
          - Support both relative dates (kemarin, besok) and specific dates (15 juli, 15/7/2024)
          - Unix timestamp must be 10 digits (seconds) between 1577836800 (2020) and 1924963200 (2030)
          - CRITICAL: Generate timestamps for year 2025, NOT 2023 or other years
          - Today's context: ${dateContext}
          
          TIMESTAMP GENERATION EXAMPLES:
          - For "kemarin" (yesterday): Calculate as ${Math.floor(new Date(new Date().getTime() - 24 * 60 * 60 * 1000).getTime() / 1000)}
          - For "besok" (tomorrow): Calculate as ${Math.floor(new Date(new Date().getTime() + 24 * 60 * 60 * 1000).getTime() / 1000)}
          - ALWAYS ensure timestamps are for 2025, current year
          
          ${language === 'Indonesian' ? `
          CONTOH TANGGAL INDONESIA:
          - "kemarin beli baso 20000" → date: valid Unix timestamp for yesterday
          - "tanggal 15 juli beli bensin 50000" → date: valid Unix timestamp for July 15
          - "3 hari lalu bayar listrik 150000" → date: valid Unix timestamp for 3 days ago
          - "minggu lalu beli kopi 25000" → date: valid Unix timestamp for last week
          - "15/7 makan siang 45000" → date: valid Unix timestamp for July 15
          ` : `
          DATE EXAMPLES ENGLISH:
          - "yesterday bought lunch 25" → date: valid Unix timestamp for yesterday
          - "july 15 bought gas 50" → date: valid Unix timestamp for July 15
          - "3 days ago paid electricity 150" → date: valid Unix timestamp for 3 days ago
          - "last week bought coffee 5" → date: valid Unix timestamp for last week
          `}
          
          ${autoCategorize ? `
          AUTO-CATEGORIZATION ENABLED:
          - If no existing category matches, suggest a new category with:
            * Appropriate name for the transaction type
            * Suitable emoji icon
            * Appropriate color (hex code)
            * Correct type (income/expense)
          - Return suggestedNewCategory object when needed
          ` : `
          AUTO-CATEGORIZATION DISABLED:
          - Only use existing categories from the list above
          - If no category matches exactly, use "Other"
          - Do not suggest new categories
          `}
          
          EXAMPLES for ${language}:
          ${language === 'Indonesian' ? `
          - "kemarin gaji 5000000" → {"amount": 5000000, "description": "Gaji", "category": "Salary", "type": "income", "confidence": 1, "date": [yesterday_timestamp]}
          - "bayar biaya pendaftaran kuliah 500rb" → {"amount": 500000, "description": "Bayar Biaya Pendaftaran Kuliah", "category": "Education", "type": "expense", "confidence": 0.95}
          - "tanggal 15 juli makan siang di mcdonald 75000" → {"amount": 75000, "description": "Makan Siang di McDonald's", "category": "Food & Dining", "type": "expense", "confidence": 0.95, "date": [july_15_timestamp]}
          - "beli kopi 25000" → {"amount": 25000, "description": "Beli Kopi", "category": "Food & Dining", "type": "expense", "confidence": 0.9} (no date = today)
          - "transfer 2jt dari ayah" → {"amount": 2000000, "description": "Transfer dari Ayah", "category": "Other", "type": "income", "confidence": 0.9}
          ` : `
          - "yesterday salary $1000" → {"amount": 1000, "description": "Salary", "category": "Salary", "type": "income", "confidence": 1, "date": [yesterday_timestamp]}
          - "july 15 lunch at mcdonald's $25" → {"amount": 25, "description": "Lunch at McDonald's", "category": "Food & Dining", "type": "expense", "confidence": 0.95, "date": [july_15_timestamp]}
          - "bought coffee $5" → {"amount": 5, "description": "Coffee", "category": "Food & Dining", "type": "expense", "confidence": 0.9} (no date = today)
          `}
          
          Return JSON with: amount (number), description (string), category (string), type ("income" or "expense"), confidence (0-1), date (Unix timestamp, ONLY if date mentioned)${autoCategorize ? ', suggestedNewCategory (object, if needed)' : ''}.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Fallback parsing for Indonesian number formats if AI fails
    let amount = Math.abs(parseFloat(result.amount || "0"));
    
    if (amount === 0 || amount < 100) {
      // Try to parse Indonesian format manually as fallback
      const indonesianAmount = parseIndonesianAmount(text);
      if (indonesianAmount > 0) {
        amount = indonesianAmount;
        console.log(`Fallback parsing detected amount: ${amount} from text: "${text}"`);
      }
    }
    
    // Parse date if provided by AI, otherwise use fallback parsing
    let transactionDate: number | undefined;
    
    // PRIORITY 1: Try fallback parsing first (more reliable)
    const relativeDate = parseRelativeDate(text, userPreferences?.language || 'id');
    const specificDate = parseSpecificDate(text, userPreferences?.language || 'id');
    const fallbackDate = relativeDate || specificDate || undefined;
    
    // Use fallback date if available (most reliable)
    if (fallbackDate) {
      transactionDate = fallbackDate;
      console.log(`✅ Using FALLBACK parsing: ${fallbackDate} (${new Date(fallbackDate * 1000).toLocaleDateString('id-ID', { timeZone: getTimezone() })})`);
    } else if (result.date && typeof result.date === 'number') {
      // PRIORITY 2: Validate AI provided date only if fallback failed
      const minTimestamp = new Date('2020-01-01').getTime() / 1000; // 1577836800
      const maxTimestamp = new Date('2030-12-31').getTime() / 1000; // 1924963200
      
      if (result.date >= minTimestamp && result.date <= maxTimestamp) {
        transactionDate = result.date;
        console.log(`⚠️ Using AI timestamp (fallback failed): ${result.date} (${new Date(result.date * 1000).toLocaleDateString()})`);
      } else if (result.date >= 1000000000000 && result.date <= 9999999999999) {
        // Convert milliseconds to seconds and validate
        const timestampInSeconds = Math.floor(result.date / 1000);
        if (timestampInSeconds >= minTimestamp && timestampInSeconds <= maxTimestamp) {
          transactionDate = timestampInSeconds;
          console.log(`⚠️ Using AI timestamp converted from ms (fallback failed): ${timestampInSeconds} (${new Date(timestampInSeconds * 1000).toLocaleDateString()})`);
        } else {
          console.log(`❌ Invalid AI timestamp after conversion: ${timestampInSeconds}, no fallback available`);
        }
      } else {
        console.log(`❌ Invalid AI timestamp: ${result.date}, no fallback available`);
      }
    } else {
      console.log(`ℹ️ No date from AI and no fallback parsing available`);
    }
    
    // Log the final result
    if (transactionDate) {
      console.log(`📅 FINAL transaction date: ${transactionDate} (${new Date(transactionDate * 1000).toLocaleDateString('id-ID', { timeZone: getTimezone() })})`);
    } else {
      console.log(`📅 No date parsed, will use current date`);
    }
    
    const analysis: TransactionAnalysis = {
      amount: amount,  // Use processed amount (either from AI or fallback)
      description: result.description || "Transaction",
      category: result.category || "Other",
      type: result.type || "expense",
      confidence: Math.max(0, Math.min(1, parseFloat(result.confidence || "0.8"))),
      suggestedNewCategory: result.suggestedNewCategory
    };
    
    // Only add date if it was parsed
    if (transactionDate) {
      analysis.date = transactionDate;
    }
    
    return analysis;
  } catch (error) {
    console.error("Failed to analyze transaction text:", error);
    throw new Error("Failed to analyze transaction: " + (error instanceof Error ? error.message : String(error)));
  }
}

export async function processReceiptImage(
  base64Image: string, 
  availableCategories: any[] = [], 
  userPreferences?: UserPreferences
): Promise<OCRResult> {
  try {
    // Format categories for AI
    const categoryList = availableCategories.length > 0 
      ? availableCategories.map(cat => `- ${cat.name}`).join('\n')
      : `- Food & Dining
- Transportation  
- Shopping
- Entertainment
- Bills & Utilities
- Healthcare
- Education
- Other`;

    // Set language and currency from preferences
    const language = userPreferences?.language === 'id' ? 'Indonesian' : 'English';
    const currency = userPreferences?.defaultCurrency || 'USD';
    const currencySymbol = getCurrencySymbol(currency);
    const autoCategorize = userPreferences?.autoCategorize ?? true;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this receipt image and extract transaction information in ${language}. 
              
              Available categories:
              ${categoryList}
              
              Currency: ${currency} (${currencySymbol})
              Auto-categorization: ${autoCategorize ? 'enabled' : 'disabled'}
              
              Instructions:
              1. Extract the merchant name, total amount, and date if visible
              2. Convert amounts to ${currency} if needed
              3. Create clear, professional descriptions in ${language}
              4. Choose the most appropriate category from the list above
              5. All transactions should be "expense" type unless clearly income
              6. Set confidence based on image clarity and text readability
              
              ${autoCategorize ? `
              AUTO-CATEGORIZATION ENABLED:
              - If no existing category matches, suggest a new category with appropriate name, icon (emoji), color (hex), and type
              ` : `
              AUTO-CATEGORIZATION DISABLED:
              - Only use existing categories, use "Other" if no match
              `}
              
              Return JSON with:
              - text: extracted text from receipt (merchant, items, total)
              - transactions: array of {amount, description, category, type, confidence${autoCategorize ? ', suggestedNewCategory (if needed)' : ''}}
              - confidence: overall confidence (0-1)
              
              Example format:
              {
                "text": "BreadTalk Receipt - Total: ${currencySymbol}43.50",
                "transactions": [
                  {
                    "amount": 43.5,
                    "description": "${language === 'Indonesian' ? 'Roti dari BreadTalk' : 'Bakery Items at BreadTalk'}",
                    "category": "Food & Dining", 
                    "type": "expense",
                    "confidence": 0.9${autoCategorize ? `,
                    "suggestedNewCategory": {
                      "name": "Bakery",
                      "icon": "🍞",
                      "color": "#F59E0B",
                      "type": "expense"
                    }` : ''}
                  }
                ],
                "confidence": 0.9
              }`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    console.log('Receipt analysis result:', result);
    
    return {
      text: result.text || "",
      transactions: result.transactions || [],
      confidence: Math.max(0, Math.min(1, parseFloat(result.confidence || "0.7"))),
    };
  } catch (error) {
    console.error("Failed to process receipt image:", error);
    throw new Error("Failed to process receipt: " + (error instanceof Error ? error.message : String(error)));
  }
}

export async function categorizeTransaction(description: string, amount: number): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `You are a financial categorization expert. Categorize transactions based on description and amount.
          
          Available categories:
          - Food & Dining
          - Transportation
          - Shopping
          - Entertainment
          - Bills & Utilities
          - Healthcare
          - Education
          - Other
          
          Return JSON with: category (string)`,
        },
        {
          role: "user",
          content: `Transaction: ${description}, Amount: $${amount}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.category || "Other";
  } catch (error) {
    console.error("Failed to categorize transaction:", error);
    return "Other";
  }
}

export async function generateFinancialInsights(
  transactions: any[],
  budgets: any[]
): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `You are a financial advisor. Analyze spending patterns and provide actionable insights.
          
          Return JSON with: insights (array of strings)
          
          Keep insights practical and specific to the user's spending patterns.`,
        },
        {
          role: "user",
          content: `Recent transactions: ${JSON.stringify(transactions.slice(0, 20))}
          
          Budgets: ${JSON.stringify(budgets)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.insights || [];
  } catch (error) {
    console.error("Failed to generate insights:", error);
    return [];
  }
}

export interface BudgetAnalysis {
  action: "create" | "update" | "delete" | "check" | "list";
  category?: string;
  amount?: number;
  period?: "weekly" | "monthly" | "yearly";
  confidence: number;
}

export interface CategoryAnalysis {
  action: "create" | "update" | "delete" | "list";
  categoryName?: string;
  newCategoryName?: string;
  icon?: string;
  color?: string;
  type?: "income" | "expense";
  confidence: number;
}

export async function analyzeBudgetCommand(
  text: string, 
  availableCategories: any[] = [], 
  userPreferences?: UserPreferences
): Promise<BudgetAnalysis> {
  try {
    // Build categories list from database
    const categoryList = availableCategories.length > 0 
      ? availableCategories.map(cat => `- ${cat.name}${cat.type ? ` (${cat.type})` : ''}`).join('\n          ')
      : `- Food & Dining
          - Transportation
          - Shopping
          - Entertainment
          - Bills & Utilities
          - Healthcare
          - Education
          - Other`;

    // Set language and currency from preferences
    const language = userPreferences?.language === 'id' ? 'Indonesian' : 'English';
    const currency = userPreferences?.defaultCurrency || 'USD';
    const currencySymbol = getCurrencySymbol(currency);

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `You are a budget management assistant. Analyze user messages about budget management in ${language}.
          
          Available categories:
          ${categoryList}
          
          Currency: ${currency} (${currencySymbol})
          
          BUDGET COMMANDS TO DETECT:
          1. CREATE/SET BUDGET: "set budget food 500000", "budget makan 300rb", "atur budget transport 200000"
          2. UPDATE BUDGET: "ubah budget food jadi 600000", "update budget transport 250000"
          3. DELETE BUDGET: "hapus budget food", "delete budget transport"
          4. CHECK BUDGET: "cek budget", "budget status", "bagaimana budget saya"
          5. LIST BUDGETS: "daftar budget", "list all budgets", "tampilkan semua budget"
          
          ${language === 'Indonesian' ? `
          CONTOH PERINTAH INDONESIA:
          - "set budget makan 500000 per bulan" → action: create, category: Food & Dining, amount: 500000, period: monthly
          - "atur budget transport 200rb mingguan" → action: create, category: Transportation, amount: 200000, period: weekly
          - "ubah budget belanja jadi 1jt" → action: update, category: Shopping, amount: 1000000, period: monthly
          - "hapus budget entertainment" → action: delete, category: Entertainment
          - "cek budget saya" → action: check
          - "daftar semua budget" → action: list
          ` : `
          ENGLISH COMMAND EXAMPLES:
          - "set food budget 500 monthly" → action: create, category: Food & Dining, amount: 500, period: monthly
          - "budget transport 200 weekly" → action: create, category: Transportation, amount: 200, period: weekly
          - "update shopping budget to 1000" → action: update, category: Shopping, amount: 1000, period: monthly
          - "delete entertainment budget" → action: delete, category: Entertainment
          - "check my budget" → action: check
          - "list all budgets" → action: list
          `}
          
          AMOUNT PARSING:
          - Support "rb" = 1000, "ribu" = 1000, "jt" = 1000000, "juta" = 1000000
          - Support "k" = 1000, "m" = 1000000 for English
          - Default period is "monthly" if not specified
          
          Return JSON with: action, category (if applicable), amount (if applicable), period (if applicable), confidence (0-1).`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      action: result.action || "check",
      category: result.category,
      amount: result.amount ? Math.abs(parseFloat(result.amount.toString())) : undefined,
      period: result.period || "monthly",
      confidence: Math.max(0, Math.min(1, parseFloat(result.confidence || "0.8")))
    };
  } catch (error) {
    console.error("Failed to analyze budget command:", error);
    throw new Error("Failed to analyze budget command: " + (error instanceof Error ? error.message : String(error)));
  }
}

export async function analyzeCategoryCommand(
  text: string, 
  availableCategories: any[] = [], 
  userPreferences?: UserPreferences
): Promise<CategoryAnalysis> {
  try {
    // Build categories list from database
    const categoryList = availableCategories.length > 0 
      ? availableCategories.map(cat => `- ${cat.name}${cat.type ? ` (${cat.type})` : ''}`).join('\n          ')
      : `- Food & Dining
          - Transportation
          - Shopping
          - Entertainment
          - Bills & Utilities
          - Healthcare
          - Education
          - Other`;

    // Set language and currency from preferences
    const language = userPreferences?.language === 'id' ? 'Indonesian' : 'English';

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `You are a category management assistant. Analyze user messages about category management in ${language}.
          
          Available categories:
          ${categoryList}
          
          CATEGORY COMMANDS TO DETECT:
          1. CREATE CATEGORY: "buat kategori", "tambah kategori", "create category", "add category"
          2. UPDATE CATEGORY: "ubah kategori", "edit kategori", "update category", "rename category"
          3. DELETE CATEGORY: "hapus kategori", "delete category", "remove category"
          4. LIST CATEGORIES: "daftar kategori", "list kategori", "list categories", "show categories"
          
          ${language === 'Indonesian' ? `
          CONTOH PERINTAH INDONESIA:
          - "buat kategori Kopi ☕ #8B4513" → action: create, categoryName: Kopi, icon: ☕, color: #8B4513, type: expense
          - "tambah kategori Investasi 💰 #00C851 income" → action: create, categoryName: Investasi, icon: 💰, color: #00C851, type: income
          - "ubah kategori Food menjadi Makanan" → action: update, categoryName: Food, newCategoryName: Makanan
          - "hapus kategori Lain-lain" → action: delete, categoryName: Lain-lain
          - "daftar kategori" → action: list
          ` : `
          ENGLISH COMMAND EXAMPLES:
          - "create category Coffee ☕ #8B4513" → action: create, categoryName: Coffee, icon: ☕, color: #8B4513, type: expense
          - "add category Investment 💰 #00C851 income" → action: create, categoryName: Investment, icon: 💰, color: #00C851, type: income
          - "rename category Food to Meals" → action: update, categoryName: Food, newCategoryName: Meals
          - "delete category Other" → action: delete, categoryName: Other
          - "list categories" → action: list
          `}
          
          PARSING RULES:
          - Icon: Single emoji after category name
          - Color: Hex code (#RRGGBB) or color name
          - Type: "income" or "expense" (default: expense if not specified)
          - For update: look for patterns like "ubah X menjadi Y", "rename X to Y"
          
          Return JSON with: action, categoryName (if applicable), newCategoryName (for updates), icon (for create), color (for create), type (for create), confidence (0-1).`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      action: result.action || "list",
      categoryName: result.categoryName,
      newCategoryName: result.newCategoryName,
      icon: result.icon,
      color: result.color,
      type: result.type || "expense",
      confidence: Math.max(0, Math.min(1, parseFloat(result.confidence || "0.8")))
    };
  } catch (error) {
    console.error("Failed to analyze category command:", error);
    throw new Error("Failed to analyze category command: " + (error instanceof Error ? error.message : String(error)));
  }
}

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  spent: number;
  budgetAmount: number;
  percentage: number;
  alertType: "warning" | "danger" | "exceeded";
  message: string;
}

export async function generateBudgetAlert(
  categoryName: string,
  spent: number,
  budgetAmount: number,
  currency: string = 'USD',
  language: string = 'id'
): Promise<BudgetAlert> {
  const percentage = (spent / budgetAmount) * 100;
  const currencySymbol = getCurrencySymbol(currency);
  
  let alertType: "warning" | "danger" | "exceeded";
  let message: string;
  
  if (percentage >= 100) {
    alertType = "exceeded";
    if (language === 'id') {
      message = `🚨 BUDGET TERLAMPAUI! Anda sudah menghabiskan ${currencySymbol}${spent.toLocaleString()} dari budget ${currencySymbol}${budgetAmount.toLocaleString()} untuk kategori ${categoryName} (${percentage.toFixed(1)}%)`;
    } else {
      message = `🚨 BUDGET EXCEEDED! You've spent ${currencySymbol}${spent.toLocaleString()} out of ${currencySymbol}${budgetAmount.toLocaleString()} budget for ${categoryName} (${percentage.toFixed(1)}%)`;
    }
  } else if (percentage >= 80) {
    alertType = "danger";
    if (language === 'id') {
      message = `⚠️ PERINGATAN BUDGET! Anda sudah menggunakan ${percentage.toFixed(1)}% dari budget ${categoryName}. Sisa: ${currencySymbol}${(budgetAmount - spent).toLocaleString()}`;
    } else {
      message = `⚠️ BUDGET WARNING! You've used ${percentage.toFixed(1)}% of your ${categoryName} budget. Remaining: ${currencySymbol}${(budgetAmount - spent).toLocaleString()}`;
    }
  } else if (percentage >= 60) {
    alertType = "warning";
    if (language === 'id') {
      message = `💡 Info Budget: Anda sudah menggunakan ${percentage.toFixed(1)}% dari budget ${categoryName}. Sisa: ${currencySymbol}${(budgetAmount - spent).toLocaleString()}`;
    } else {
      message = `💡 Budget Info: You've used ${percentage.toFixed(1)}% of your ${categoryName} budget. Remaining: ${currencySymbol}${(budgetAmount - spent).toLocaleString()}`;
    }
  } else {
    alertType = "warning";
    if (language === 'id') {
      message = `✅ Budget ${categoryName} masih aman. Terpakai: ${percentage.toFixed(1)}%. Sisa: ${currencySymbol}${(budgetAmount - spent).toLocaleString()}`;
    } else {
      message = `✅ ${categoryName} budget is safe. Used: ${percentage.toFixed(1)}%. Remaining: ${currencySymbol}${(budgetAmount - spent).toLocaleString()}`;
    }
  }
  
  return {
    categoryId: categoryName.toLowerCase().replace(/\s+/g, '_'),
    categoryName,
    spent,
    budgetAmount,
    percentage,
    alertType,
    message
  };
}

export interface BudgetRecommendation {
  category: string;
  categoryId: number;
  recommendedAmount: number;
  period: "monthly" | "weekly";
  reasoning: string;
  confidence: number;
}

export interface FinancialProfile {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  topCategories: Array<{category: string; amount: number; percentage: number}>;
  monthlyPattern: any[];
  riskLevel: "conservative" | "moderate" | "aggressive";
}

export async function analyzeFinancialProfile(
  userId: string,
  transactions: any[],
  userPreferences?: UserPreferences
): Promise<FinancialProfile> {
  try {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    // Filter recent transactions (last 3 months)
    const recentTransactions = transactions.filter(t => 
      new Date(t.date * 1000) >= threeMonthsAgo
    );
    
    const income = recentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const monthlyIncome = income / 3;
    const monthlyExpenses = expenses / 3;
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
    
    // Analyze spending by category
    const categorySpending: Record<string, number> = {};
    recentTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const categoryName = t.category?.name || 'Other';
        categorySpending[categoryName] = (categorySpending[categoryName] || 0) + t.amount;
      });
    
    const topCategories = Object.entries(categorySpending)
      .map(([category, amount]) => ({
        category,
        amount: amount / 3, // Monthly average
        percentage: (amount / expenses) * 100
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    // Determine risk level based on savings rate
    let riskLevel: "conservative" | "moderate" | "aggressive";
    if (savingsRate >= 20) {
      riskLevel = "aggressive";
    } else if (savingsRate >= 10) {
      riskLevel = "moderate";
    } else {
      riskLevel = "conservative";
    }
    
    return {
      totalIncome: monthlyIncome,
      totalExpenses: monthlyExpenses,
      savingsRate,
      topCategories,
      monthlyPattern: [], // Could be enhanced later
      riskLevel
    };
  } catch (error) {
    console.error('Error analyzing financial profile:', error);
    throw error;
  }
}

export async function generateBudgetRecommendations(
  userId: string,
  financialProfile: FinancialProfile,
  availableCategories: any[],
  missingCategory?: string,
  userPreferences?: UserPreferences,
  rawTransactions?: any[]
): Promise<BudgetRecommendation[]> {
  try {
    const language = userPreferences?.language === 'id' ? 'Indonesian' : 'English';
    const currency = userPreferences?.defaultCurrency || 'USD';
    const currencySymbol = getCurrencySymbol(currency);
    
    // Create financial summary for AI
    const financialSummary = {
      monthlyIncome: financialProfile.totalIncome,
      monthlyExpenses: financialProfile.totalExpenses,
      savingsRate: financialProfile.savingsRate,
      riskLevel: financialProfile.riskLevel,
      topSpendingCategories: financialProfile.topCategories
    };
    
    // Filter transactions for the specific category if we have raw transaction data
    let categoryTransactions: any[] = [];
    if (rawTransactions && missingCategory) {
      categoryTransactions = rawTransactions.filter(t => 
        t.category?.name === missingCategory || 
        (typeof t.category === 'string' && t.category === missingCategory)
      );
      console.log(`[BUDGET AI DEBUG] Found ${categoryTransactions.length} transactions for category ${missingCategory}:`, 
        categoryTransactions.map(t => ({ description: t.description, amount: t.amount, category: t.category }))
      );
    }
    
    const categoryList = availableCategories.map(cat => 
      `- ${cat.name} (ID: ${cat.id})`
    ).join('\n');
    
    let prompt = '';
    
    if (missingCategory) {
      // Single category recommendation
      prompt = `As a financial advisor AI, recommend a budget for the "${missingCategory}" category based on this user's financial profile.`;
    } else {
      // All categories recommendation
      prompt = `As a financial advisor AI, recommend budgets for ALL available categories based on this user's financial profile.`;
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `You are an expert financial advisor. Create realistic budget recommendations in ${language}.
          
          User's Financial Profile:
          ${JSON.stringify(financialSummary, null, 2)}
          
          ${categoryTransactions.length > 0 ? `
          =================== ACTUAL TRANSACTIONS TO ANALYZE ===================
          FOR CATEGORY "${missingCategory}", THESE ARE THE REAL TRANSACTIONS:
          ${categoryTransactions.map((t, i) => 
            `${i + 1}. DESCRIPTION: "${t.description}" - AMOUNT: ${currencySymbol}${t.amount.toLocaleString()}`
          ).join('\n          ')}
          
          YOU MUST CLASSIFY EACH TRANSACTION ABOVE AS ONE-TIME OR RECURRING FIRST
          ================================================================
          ` : ''}
          
          Available Categories:
          ${categoryList}
          
          Currency: ${currency} (${currencySymbol})
          
          CRITICAL JSON FORMAT RULES:
          1. MUST return valid JSON array with "recommendations" property
          2. NO extra properties outside the required structure
          3. Use simple, clean text for reasoning - no special characters or line breaks that break JSON
          4. Keep reasoning concise and professional
          
          BUDGET RECOMMENDATION RULES:
          1. Total recommended budgets should not exceed 80% of monthly income
          2. Keep 20% buffer for savings and unexpected expenses
          3. Prioritize essential categories (Food, Transportation, Bills)
          4. Consider user's historical spending patterns
          5. Adjust based on risk level (conservative = lower budgets, aggressive = higher budgets)
          6. Recommend monthly budgets by default
          7. For one-time expenses (like education fees), calculate reasonable monthly allocation
          8. IMPORTANT: If a large one-time expense was just recorded, don't use it as baseline for monthly budget
          
          CRITICAL EXPENSE TYPE ANALYSIS:
          STEP 1: First, analyze ALL transactions in the category and classify each one:
          
          ONE-TIME EXPENSES (COMPLETELY EXCLUDE from budget calculation):
          Keywords: "pendaftaran", "uang pangkal", "biaya masuk", "registration", "enrollment", "deposit", "down payment", "setup", "activation", "administrasi awal"
          
          RECURRING EXPENSES (USE ONLY THESE for budget calculation):
          Keywords: "SPP", "uang sekolah", "tuition", "monthly", "bulanan", "les", "kursus", "course", "transport sekolah", "buku", "bensin", "fuel", "toll", "parkir"
          
          STEP 2: Budget Calculation Method:
          - Take ONLY recurring transactions from the category  
          - Calculate average of recurring transactions only
          - Add 15-20% buffer to recurring average
          - If NO recurring transactions exist, recommend minimum based on category type
          - NEVER include one-time expenses in the average calculation
          
          REASONING GUIDELINES:
          - Write in simple, clear ${language} without complex formatting
          - Keep it concise (max 200 characters)
          - Focus on practical advice
          - Avoid technical jargon
          
          VALID JSON STRUCTURE EXAMPLE:
          {
            "recommendations": [
              {
                "category": "Transportation",
                "categoryId": 35,
                "recommendedAmount": 300000,
                "period": "monthly",
                "reasoning": "Berdasarkan pembelian bensin Rp50.000, diperkirakan kebutuhan transportasi bulanan sekitar Rp300.000 dengan buffer 20% untuk biaya tak terduga.",
                "confidence": 0.85
              }
            ]
          }
          
          Return JSON object with "recommendations" array containing the budget recommendation.`,
        },
        {
          role: "user",
          content: missingCategory 
            ? `Please recommend a budget for "${missingCategory}" category only. Return valid JSON with "recommendations" array.`
            : `Please recommend budgets for all available categories. Return valid JSON with "recommendations" array.`
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent JSON
    });
    
    console.log(`[BUDGET AI DEBUG] AI Response for category ${missingCategory}:`, response.choices[0].message.content);

    let result;
    try {
      result = JSON.parse(response.choices[0].message.content || "{}");
    } catch (parseError) {
      console.error(`[BUDGET AI ERROR] Invalid JSON response:`, response.choices[0].message.content);
      console.error(`[BUDGET AI ERROR] Parse error:`, parseError);
      
      // Fallback: create a simple recommendation based on transaction amounts
      if (categoryTransactions.length > 0) {
        const avgAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0) / categoryTransactions.length;
        const recommendedAmount = Math.round(avgAmount * 1.2); // 20% buffer
        
        result = {
          recommendations: [{
            category: missingCategory,
            categoryId: availableCategories.find(cat => cat.name === missingCategory)?.id || 0,
            recommendedAmount,
            period: "monthly",
            reasoning: `Budget disarankan berdasarkan rata-rata pengeluaran Rp${avgAmount.toLocaleString()} dengan buffer 20%.`,
            confidence: 0.7
          }]
        };
        console.log(`[BUDGET AI FALLBACK] Generated fallback recommendation:`, result);
      } else {
        // No transactions, return minimal recommendation
        result = {
          recommendations: [{
            category: missingCategory,
            categoryId: availableCategories.find(cat => cat.name === missingCategory)?.id || 0,
            recommendedAmount: 100000,
            period: "monthly", 
            reasoning: "Budget minimal untuk kategori ini.",
            confidence: 0.5
          }]
        };
      }
    }
    
    const recommendations = result.recommendations || [];
    
    // Ensure recommendations is an array
    return Array.isArray(recommendations) ? recommendations : [recommendations];
    
  } catch (error) {
    console.error('Error generating budget recommendations:', error);
    throw error;
  }
}

// Interface for savings command analysis
export interface SavingsAnalysis {
  action: 'save' | 'create_goal' | 'list_goals' | 'check_balance' | 'set_plan' | 'transfer_goal' | 'delete_goal' | 'return_funds' | 'unknown';
  confidence: number;
  goalName?: string;
  targetGoalName?: string; // For transfer operations
  amount?: number;
  targetAmount?: number;
  deadline?: number; // Unix timestamp
  frequency?: 'weekly' | 'monthly' | 'yearly';
  description?: string;
  category?: string;
}

/**
 * Analyze savings/goals command using AI
 */
export async function analyzeSavingsCommand(
  text: string,
  userGoals: any[],
  userPreferences: any
): Promise<SavingsAnalysis> {
  try {
    console.log('Analyzing savings command:', text);
    
    const goalsList = userGoals.map(g => `- ${g.name}: ${g.currentAmount}/${g.targetAmount} (${g.category || 'general'})`).join('\n');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert financial assistant specialized in analyzing savings and financial goals commands in both Indonesian and English.

          AVAILABLE ACTIONS:
          1. save - User wants to save money to an existing goal
          2. create_goal - User wants to create a new financial goal
          3. list_goals - User wants to see all their goals
          4. check_balance - User wants to check their savings/goals balance
          5. set_plan - User wants to set up automatic savings plan
          6. transfer_goal - User wants to transfer money between goals
          7. delete_goal - User wants to delete a goal
          8. return_funds - User wants to return money from a goal back to main balance
          9. unknown - Command is unclear

          ANALYSIS RULES:
          - For 'save' action, amount must be specified and goal should exist
          - For 'create_goal', goal name and target amount are required
          - For 'transfer_goal', amount, source goal, and target goal are required
          - For 'delete_goal', goal name must be specified
          - For 'return_funds', goal name must be specified (amount optional, returns all if not specified)
          - For 'list_goals' with "completed" keyword, set goalName to "completed"
          - Parse numbers in Indonesian/English (ribu=1000, juta=1000000, rb=1000, etc.)
          - Detect time periods: harian/daily, mingguan/weekly, bulanan/monthly, tahunan/yearly
          - Extract goal categories: emergency, vacation, gadget, education, investment, etc.
          - Be confident only if command is clear (confidence > 0.7)

          USER'S CURRENT GOALS:
          ${goalsList || 'No goals yet'}

          LANGUAGE PATTERNS:
          Indonesian: nabung, menabung, tabung, target, tujuan, goal, buat goal, cek tabungan, saldo goal, transfer, pindah, hapus
          - Completed/Archive: completed, tercapai, selesai, archive, arsip, yang sudah tercapai, yang selesai
          - Return/Refund: kembalikan, kembalikan dana, refund, return, tarik dana, withdraw
          English: save, saving, goal, create goal, check savings, goal balance, transfer, move, delete
          - Completed/Archive: completed, finished, achieved, archived, done
          - Return/Refund: return, refund, withdraw, take out, get back

          EXAMPLES:
          Indonesian:
          - "nabung 100000 untuk beli rumah" → {"action": "save", "confidence": 0.9, "amount": 100000, "goalName": "beli rumah"}
          - "buat goal liburan target 5 juta" → {"action": "create_goal", "confidence": 0.9, "goalName": "liburan", "targetAmount": 5000000}
          - "daftar goal" → {"action": "list_goals", "confidence": 1}
          - "daftar goal completed" → {"action": "list_goals", "confidence": 1, "goalName": "completed"}
          - "lihat goal yang sudah tercapai" → {"action": "list_goals", "confidence": 0.9, "goalName": "completed"}
          - "goal archive" → {"action": "list_goals", "confidence": 0.8, "goalName": "completed"}
          - "transfer 500000 dari emergency ke liburan" → {"action": "transfer_goal", "confidence": 0.9, "amount": 500000, "goalName": "emergency", "targetGoalName": "liburan"}
          - "hapus goal emergency fund" → {"action": "delete_goal", "confidence": 0.9, "goalName": "emergency fund"}
          - "kembalikan dana beli laptop ke saldo" → {"action": "return_funds", "confidence": 0.9, "goalName": "beli laptop"}
          - "kembalikan 500000 dari vacation ke saldo" → {"action": "return_funds", "confidence": 0.9, "amount": 500000, "goalName": "vacation"}
          - "tarik dana dari emergency fund" → {"action": "return_funds", "confidence": 0.8, "goalName": "emergency fund"}
          - "cek tabungan" → {"action": "check_balance", "confidence": 1}

          English:
          - "save 100000 for house" → {"action": "save", "confidence": 0.9, "amount": 100000, "goalName": "house"}
          - "create goal vacation target 5000" → {"action": "create_goal", "confidence": 0.9, "goalName": "vacation", "targetAmount": 5000}
          - "list completed goals" → {"action": "list_goals", "confidence": 1, "goalName": "completed"}
          - "show archived goals" → {"action": "list_goals", "confidence": 0.9, "goalName": "completed"}
          - "transfer 500 from emergency to vacation" → {"action": "transfer_goal", "confidence": 0.9, "amount": 500, "goalName": "emergency", "targetGoalName": "vacation"}
          - "delete goal emergency" → {"action": "delete_goal", "confidence": 0.9, "goalName": "emergency"}
          - "return funds from laptop goal" → {"action": "return_funds", "confidence": 0.9, "goalName": "laptop"}
          - "withdraw 500 from vacation goal" → {"action": "return_funds", "confidence": 0.9, "amount": 500, "goalName": "vacation"}
          - "get money back from emergency fund" → {"action": "return_funds", "confidence": 0.8, "goalName": "emergency fund"}

          SPECIAL DETECTION RULES:
          1. If text contains "completed", "tercapai", "selesai", "archive", "arsip" + list/daftar keywords:
             → action: "list_goals", goalName: "completed"
          2. If text contains "aktif", "active" + list/daftar keywords:
             → action: "list_goals", goalName: undefined (default shows active)
          3. If text contains "kembalikan", "refund", "return", "tarik dana", "withdraw" + goal reference:
             → action: "return_funds", goalName: [detected goal name]
          4. Look for specific goal names that user wants to interact with
          5. For transfers, detect "dari/from" (source) and "ke/to" (target) patterns
          6. For returns, detect "ke saldo", "to balance", "back to account" patterns

          Return JSON with action, confidence (0-1), and relevant extracted data. Use 'goalName' and 'targetGoalName' properties for goal names.`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    console.log('Savings command analysis result:', result);
    
    return {
      action: result.action || 'unknown',
      confidence: result.confidence || 0,
      goalName: result.goalName || result.goal, // Handle both goalName and goal properties
      targetGoalName: result.targetGoalName,
      amount: result.amount,
      targetAmount: result.targetAmount,
      deadline: result.deadline,
      frequency: result.frequency,
      description: result.description,
      category: result.category
    };
    
  } catch (error) {
    console.error('Error analyzing savings command:', error);
    return {
      action: 'unknown',
      confidence: 0
    };
  }
}
