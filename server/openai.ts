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

// Helper function to get current date info for AI context
function getCurrentDateContext(language: string = 'id'): string {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const dayOfWeek = now.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'long' });
  const monthName = now.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'long' });
  const year = now.getFullYear();
  const date = now.getDate();
  
  if (language === 'id') {
    return `Hari ini: ${dayOfWeek}, ${date} ${monthName} ${year} (${today})`;
  } else {
    return `Today: ${dayOfWeek}, ${monthName} ${date}, ${year} (${today})`;
  }
}

// Helper function to parse relative dates to Unix timestamp
function parseRelativeDate(text: string, language: string = 'id'): number | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Indonesian relative date patterns
  if (language === 'id') {
    if (/kemarin|yesterday/i.test(text)) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return Math.floor(yesterday.getTime() / 1000);
    }
    
    if (/lusa|day after tomorrow/i.test(text)) {
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      return Math.floor(dayAfterTomorrow.getTime() / 1000);
    }
    
    if (/besok|tomorrow/i.test(text)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return Math.floor(tomorrow.getTime() / 1000);
    }
    
    // Pattern for "X hari yang lalu" or "X days ago"
    const daysAgoMatch = text.match(/(\d+)\s*(hari|days?)\s*(yang\s*)?(lalu|ago)/i);
    if (daysAgoMatch) {
      const daysAgo = parseInt(daysAgoMatch[1]);
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - daysAgo);
      return Math.floor(targetDate.getTime() / 1000);
    }
    
    // Pattern for "minggu lalu" or "last week"
    if (/minggu\s+(lalu|kemarin)|last\s+week/i.test(text)) {
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      return Math.floor(lastWeek.getTime() / 1000);
    }
  }
  
  // English relative date patterns  
  if (/yesterday/i.test(text)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return Math.floor(yesterday.getTime() / 1000);
  }
  
  if (/tomorrow/i.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return Math.floor(tomorrow.getTime() / 1000);
  }
  
  const daysAgoMatch = text.match(/(\d+)\s*days?\s+ago/i);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1]);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() - daysAgo);
    return Math.floor(targetDate.getTime() / 1000);
  }
  
  if (/last\s+week/i.test(text)) {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return Math.floor(lastWeek.getTime() / 1000);
  }
  
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
          - If date IS mentioned, include "date" field with Unix timestamp
          - Support both relative dates (kemarin, besok) and specific dates (15 juli, 15/7/2024)
          
          ${language === 'Indonesian' ? `
          CONTOH TANGGAL INDONESIA:
          - "kemarin beli baso 20000" → date: yesterday's timestamp
          - "tanggal 15 juli beli bensin 50000" → date: July 15 timestamp
          - "3 hari lalu bayar listrik 150000" → date: 3 days ago timestamp
          - "minggu lalu beli kopi 25000" → date: last week timestamp
          - "15/7 makan siang 45000" → date: July 15 timestamp
          ` : `
          DATE EXAMPLES ENGLISH:
          - "yesterday bought lunch 25" → date: yesterday's timestamp
          - "july 15 bought gas 50" → date: July 15 timestamp
          - "3 days ago paid electricity 150" → date: 3 days ago timestamp
          - "last week bought coffee 5" → date: last week timestamp
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
    
    if (result.date && typeof result.date === 'number') {
      // AI provided a date
      transactionDate = result.date;
    } else {
      // Try to parse date from original text as fallback
      const relativeDate = parseRelativeDate(text, userPreferences?.language || 'id');
      const specificDate = parseSpecificDate(text, userPreferences?.language || 'id');
      
      transactionDate = relativeDate || specificDate || undefined;
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
          Keywords: "SPP", "uang sekolah", "tuition", "monthly", "bulanan", "les", "kursus", "course", "transport sekolah", "buku"
          
          STEP 2: Budget Calculation Method:
          - MANDATORY: List each transaction with its classification first
          - Take ONLY recurring transactions from the category  
          - Calculate average of recurring transactions only
          - Add 15-20% buffer to recurring average
          - If NO recurring transactions exist, recommend minimum 150,000-200,000 for the category
          - NEVER include one-time expenses in the average calculation
          
          CRITICAL: REASONING MUST SOUND NATURAL AND PROFESSIONAL
          - Write like a human financial advisor explaining to a client
          - Avoid robotic phrases like "kata mengandung", "diklasifikasi", "menunjukkan"
          - Focus on the practical financial planning aspect
          - Explain the logic behind separating one-time vs recurring costs
          - Make it sound like professional advice, not technical analysis
          
          SMART AMOUNT CALCULATION:
          - CRITICAL: Analyze transaction description to identify expense type FIRST
          - One-time expenses: "biaya pendaftaran", "uang pangkal", "uang masuk", "down payment", "biaya administrasi awal"
          - Recurring expenses: "SPP", "uang sekolah bulanan", "les", "kursus", "transport sekolah", "buku"
          - NEVER mix one-time and recurring for budget calculation
          - For recurring expenses: Use ONLY recurring amounts + 15-20% buffer
          - For categories with mix: Base budget on recurring expenses only, ignore one-time
          - Example: "biaya pendaftaran 500rb" (ignore) + "SPP 300rb" (use) → Budget: 350rb-400rb/month
          - Minimum budget: 50,000 for any category
          
          ${language === 'Indonesian' ? `
          WAJIB IKUTI CONTOH ANALISA STEP-BY-STEP INDONESIA:
          
          Scenario: Kategori Education punya transaksi:
          1. "Biaya Pendaftaran" - Rp500.000
          2. "SPP Sekolah" - Rp300.000
          
          STEP 1 - ANALISA TRANSAKSI SATU PER SATU:
          ❌ Transaksi 1: "Biaya Pendaftaran" Rp500.000 = ONE-TIME (kata "pendaftaran" = diabaikan)
          ✅ Transaksi 2: "SPP Sekolah" Rp300.000 = RECURRING (kata "SPP" = digunakan)
          
          STEP 2 - PERHITUNGAN BUDGET FINAL:
          - Transaksi ONE-TIME yang diabaikan: Rp500.000 (pendaftaran)  
          - Transaksi RECURRING yang dipakai: Rp300.000 (SPP)
          - Rata-rata dari RECURRING saja: Rp300.000
          - Budget final: Rp300.000 + 20% buffer = Rp360.000/bulan
          
          REASONING WAJIB: "Saya lihat ada biaya pendaftaran Rp500.000 yang tentu saja cuma dibayar sekali waktu daftar. Yang rutin tiap bulan adalah SPP Rp300.000. Makanya budget yang saya sarankan itu Rp360.000/bulan - dari SPP ditambah sedikit buffer buat jaga-jaga, sekitar 20%. Biaya pendaftaran tadi ga usah diitung karena kan cuma sekali aja."
          
          CONTOH LAIN - JIKA SEMUA ONE-TIME:
          Jika hanya ada "Biaya Pendaftaran" Rp500.000 (semua one-time):
          - Hasil: Budget minimum Rp150.000/bulan untuk kebutuhan rutin kategori ini
          - Reasoning: "Saya lihat cuma ada biaya pendaftaran Rp500.000 aja nih, yang jelas ini cuma bayar sekali waktu daftar. Nah tapi buat kebutuhan sekolah sehari-hari kayak buku, alat tulis, atau keperluan kecil lainnya, sebaiknya siap-siap budget sekitar Rp150.000/bulan deh."
          ` : `
          EXAMPLE STEP-BY-STEP ANALYSIS ENGLISH:
          
          Scenario: Education category has transactions:
          1. "Registration Fee Payment" - $500
          2. "Monthly Tuition Payment" - $300
          
          STEP 1 - Classification:
          ❌ "Registration Fee Payment" = ONE-TIME (contains "registration" = ignored)
          ✅ "Monthly Tuition Payment" = RECURRING (contains "tuition" = used)
          
          STEP 2 - Budget Calculation:
          - ONE-TIME transactions to ignore: $500 (registration)
          - RECURRING transactions to use: $300 (tuition)
          - Average recurring: $300 (only 1 recurring transaction)
          - Budget recommendation: $300 + 20% buffer = $360/month
          
          REASONING: "$360/month budget based on recurring tuition $300/month with 20% buffer. Registration fee $500 excluded as it contains 'registration' keyword indicating one-time expense."
          `}
          
          ${language === 'Indonesian' ? `
          REASONING DALAM BAHASA INDONESIA - GUNAKAN BAHASA YANG NATURAL DAN SANTAI:
          - WAJIB: Tulis seperti teman yang kasih saran keuangan, BUKAN seperti robot atau bank formal
          - Gunakan bahasa sehari-hari yang natural dan mudah dipahami
          - Boleh pakai kata "saya lihat", "makanya", "buat", "kayak", "nih", "deh" 
          - SANGAT DILARANG kata teknis: "mengandung kata", "diklasifikasi", "menunjukkan bahwa", "oleh karena itu"
          - Contoh reasoning yang BAGUS (pakai ini sebagai template):
            * "Saya lihat ada biaya pendaftaran Rp500.000 yang tentu saja cuma dibayar sekali waktu daftar. Yang rutin tiap bulan adalah SPP Rp300.000. Makanya budget yang saya sarankan itu Rp360.000/bulan - dari SPP ditambah sedikit buffer buat jaga-jaga, sekitar 20%. Biaya pendaftaran tadi ga usah diitung karena kan cuma sekali aja."
            * "Dari data pengeluaran, cuma ada biaya pendaftaran Rp500.000 yang jelas ini pembayaran sekali aja waktu daftar. Buat keperluan sekolah harian kayak buku, alat tulis, saya saranin budget Rp150.000/bulan sebagai persiapan."
          - Contoh reasoning yang BURUK (JANGAN PAKAI):
            * "Kata 'pendaftaran' menunjukkan pengeluaran satu kali, sehingga diklasifikasi sebagai pengeluaran sekali bayar"
            * "Berdasarkan transaksi yang tercatat, terdapat pengeluaran dengan deskripsi yang mengandung kata..."
            * "Oleh karena itu, untuk perencanaan budget bulanan, kami fokus pada..."
          ` : `
          REASONING IN ENGLISH - USE NATURAL LANGUAGE:
          - Explain like a professional financial advisor, not like a bot
          - Avoid technical phrases like "contains keyword", "classified as", "one-time payment"
          - Use natural, easy-to-understand language
          - Example GOOD reasoning:
            * "Based on your spending history, the $500 registration fee is a one-time cost that only occurs when enrolling. However, the $300 tuition is a monthly recurring expense. For monthly budget planning, we focus on recurring expenses like tuition and add a 20% buffer, resulting in $360/month."
          - Example BAD reasoning (AVOID):
            * "Transaction contains 'registration' keyword indicating one-time expense"
            * "Transaction classified as recurring based on 'tuition' keyword"
          `}
          
          Return JSON array with objects containing:
          - category: category name (exact match from available categories)
          - categoryId: category ID number
          - recommendedAmount: recommended monthly budget amount
          - period: "monthly" (default)
          - reasoning: explanation in ${language}
          - confidence: 0-1 confidence score
          
          Example format:
          [
            {
              "category": "Food & Dining",
              "categoryId": 1,
              "recommendedAmount": 1500000,
              "period": "monthly",
              "reasoning": "${language === 'Indonesian' ? 'Saya lihat rata-rata pengeluaran makanan sekitar Rp1.200.000/bulan. Buat kasih sedikit ruang gerak, saya saranin budget Rp1.500.000/bulan. Jadi masih bisa fleksibel tapi tetap terkontrol.' : 'Based on your average food spending of $400, we recommend $500 budget to provide flexibility while staying controlled.'}",
              "confidence": 0.85
            }
          ]`,
        },
        {
          role: "user",
          content: missingCategory 
            ? `Please recommend a budget for "${missingCategory}" category only. CRITICAL: Make sure to analyze each transaction individually to classify one-time vs recurring expenses first. Show your step-by-step classification in the reasoning.`
            : `Please recommend budgets for all available categories.`
        },
      ],
      response_format: { type: "json_object" },
    });
    
    console.log(`[BUDGET AI DEBUG] AI Response for category ${missingCategory}:`, response.choices[0].message.content);

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const recommendations = result.recommendations || result || [];
    
    // Ensure recommendations is an array
    return Array.isArray(recommendations) ? recommendations : [recommendations];
    
  } catch (error) {
    console.error('Error generating budget recommendations:', error);
    throw error;
  }
}
