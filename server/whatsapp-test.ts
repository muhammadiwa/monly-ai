/**
 * WhatsApp Integration Test Suite
 * 
 * Test file untuk memverifikasi bahwa semua fungsi AI WhatsApp bekerja dengan benar
 */

import { analyzeTransactionText, processReceiptImage } from './openai';

// Test data
const testCategories = [
  { id: 1, name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B', type: 'expense' },
  { id: 2, name: 'Transportation', icon: '🚗', color: '#4ECDC4', type: 'expense' },
  { id: 3, name: 'Shopping', icon: '🛍️', color: '#45B7D1', type: 'expense' },
  { id: 4, name: 'Salary', icon: '💰', color: '#96CEB4', type: 'income' },
  { id: 5, name: 'Other', icon: '📝', color: '#FFEAA7', type: 'expense' }
];

const testPreferences = {
  defaultCurrency: 'IDR',
  language: 'id',
  autoCategorize: true
};

/**
 * Test text analysis function
 */
export async function testTextAnalysis() {
  console.log('🧪 Testing Text Analysis...');
  
  const testMessages = [
    'Makan siang di McD 75000',
    'Beli bensin 50000',
    'Gaji bulan ini 5000000',
    'Transfer dari ayah 200000',
    'Bayar listrik 150000',
    'Beli kopi 25000'
  ];
  
  for (const message of testMessages) {
    try {
      console.log(`\nTesting: "${message}"`);
      const result = await analyzeTransactionText(message, testCategories, testPreferences);
      console.log('Result:', {
        amount: result.amount,
        description: result.description,
        category: result.category,
        type: result.type,
        confidence: result.confidence,
        suggestedNewCategory: result.suggestedNewCategory ? 'Yes' : 'No'
      });
    } catch (error) {
      console.error(`Error analyzing "${message}":`, error);
    }
  }
}

/**
 * Test image/receipt processing
 */
export async function testImageProcessing() {
  console.log('\n🧪 Testing Image Processing...');
  
  // Sample base64 image data (would normally come from WhatsApp)
  // This is just a placeholder - in real usage, this would be actual receipt image data
  const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  try {
    console.log('Processing sample receipt image...');
    const result = await processReceiptImage(sampleBase64, testCategories, testPreferences);
    console.log('Image processing result:', {
      text: result.text,
      transactionCount: result.transactions.length,
      confidence: result.confidence,
      transactions: result.transactions.map(t => ({
        amount: t.amount,
        description: t.description,
        category: t.category,
        type: t.type
      }))
    });
  } catch (error) {
    console.error('Error processing image:', error);
  }
}

/**
 * Test helper functions
 */
export function testHelperFunctions() {
  console.log('\n🧪 Testing Helper Functions...');
  
  // Test currency formatting
  const formatCurrency = (amount: number, currency: string = 'USD') => {
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
    
    const symbol = symbols[currency] || currency;
    const formatter = new Intl.NumberFormat('id-ID');
    
    return `${symbol}${formatter.format(amount)}`;
  };
  
  console.log('Currency formatting tests:');
  console.log('75000 IDR:', formatCurrency(75000, 'IDR'));
  console.log('50 USD:', formatCurrency(50, 'USD'));
  console.log('5000000 IDR:', formatCurrency(5000000, 'IDR'));
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🚀 Starting WhatsApp Integration Tests...\n');
  
  testHelperFunctions();
  await testTextAnalysis();
  await testImageProcessing();
  
  console.log('\n✅ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
