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
          - "tanggal 15 juli makan siang di mcdonald 75000" → {"amount": 75000, "description": "Makan Siang di McDonald's", "category": "Food & Dining", "type": "expense", "confidence": 0.95, "date": [july_15_timestamp]}
          - "beli kopi 25000" → {"amount": 25000, "description": "Beli Kopi", "category": "Food & Dining", "type": "expense", "confidence": 0.9} (no date = today)
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
      amount: Math.abs(parseFloat(result.amount || "0")),
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
