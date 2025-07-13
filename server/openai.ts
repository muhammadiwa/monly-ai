import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a financial transaction analyzer. Extract transaction details from user messages in ${language}.
          
          Available categories:
          ${categoryList}
          
          Currency: ${currency} (${currencySymbol})
          Auto-categorization: ${autoCategorize ? 'enabled' : 'disabled'}
          
          IMPORTANT FORMATTING RULES:
          1. Respond in ${language}
          2. Format amounts in ${currency} currency
          3. Format description with proper title case
          4. Use proper capitalization for brand names
          5. Make descriptions clear and concise
          
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
          - "gaji bulan ini 5000000" → {"amount": 5000000, "description": "Gaji Bulanan", "category": "Salary", "type": "income", "confidence": 1}
          - "makan siang di mcdonald 75000" → {"amount": 75000, "description": "Makan Siang di McDonald's", "category": "Food & Dining", "type": "expense", "confidence": 0.95}
          ` : `
          - "my salary $1000" → {"amount": 1000, "description": "Monthly Salary", "category": "Salary", "type": "income", "confidence": 1}
          - "lunch at mcdonald's $25" → {"amount": 25, "description": "Lunch at McDonald's", "category": "Food & Dining", "type": "expense", "confidence": 0.95}
          `}
          
          Return JSON with: amount (number), description (string), category (string), type ("income" or "expense"), confidence (0-1)${autoCategorize ? ', suggestedNewCategory (object, if needed)' : ''}.`,
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
      amount: Math.abs(parseFloat(result.amount || "0")),
      description: result.description || "Transaction",
      category: result.category || "Other",
      type: result.type || "expense",
      confidence: Math.max(0, Math.min(1, parseFloat(result.confidence || "0.8"))),
      suggestedNewCategory: result.suggestedNewCategory
    };
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
      model: "gpt-4o",
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
      model: "gpt-4o",
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
      model: "gpt-4o",
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
