import { storage } from './storage';
import { transactionReminderService } from './transaction-reminder-service';

async function testTransactionReminders() {
  console.log('🧪 Testing Transaction Reminders Implementation...\n');

  try {
    // Test 1: Get users with transaction reminders enabled
    console.log('1️⃣ Testing getUsersWithTransactionReminders...');
    const usersWithReminders = await storage.getUsersWithTransactionReminders();
    console.log(`Found ${usersWithReminders.length} users with transaction reminders enabled:`);
    usersWithReminders.forEach(user => {
      console.log(`   - ${user.email} (${user.id})`);
    });
    console.log('');

    // Test 2: Check if a specific user has logged transactions today
    if (usersWithReminders.length > 0) {
      const testUser = usersWithReminders[0];
      console.log(`2️⃣ Testing hasUserLoggedTransactionToday for user ${testUser.email}...`);
      
      const hasLoggedToday = await transactionReminderService.hasUserLoggedTransactionToday(testUser.id);
      console.log(`   User has logged transactions today: ${hasLoggedToday}`);
      console.log('');

      // Test 3: Get user's WhatsApp numbers
      console.log(`3️⃣ Testing getUserWhatsAppNumbers for user ${testUser.email}...`);
      const whatsappNumbers = await transactionReminderService.getUserWhatsAppNumbers(testUser.id);
      console.log(`   Found ${whatsappNumbers.length} WhatsApp numbers:`);
      whatsappNumbers.forEach(number => {
        console.log(`   - ${number}`);
      });
      console.log('');

      // Test 4: Get user preferences
      console.log(`4️⃣ Testing getUserPreferences for user ${testUser.email}...`);
      const preferences = await storage.getUserPreferences(testUser.id);
      console.log(`   Transaction reminders enabled: ${preferences?.transactionReminders}`);
      console.log(`   Language: ${preferences?.language}`);
      console.log('');

      // Test 5: Get notification logs
      console.log(`5️⃣ Testing getNotificationLogs for user ${testUser.email}...`);
      const notificationLogs = await storage.getNotificationLogs(testUser.id, 10);
      console.log(`   Found ${notificationLogs.length} notification logs (last 10)`);
      notificationLogs.forEach(log => {
        const date = new Date(log.sentAt).toLocaleString();
        console.log(`   - ${log.type}: ${log.status} at ${date}`);
      });
      console.log('');
    }

    // Test 6: Manual trigger of reminders (without actually sending)
    console.log('6️⃣ Testing checkAndSendReminders (dry run)...');
    console.log('   Note: This will actually check users and send reminders if needed');
    
    // Uncomment the line below to actually test sending reminders
    // await transactionReminderService.checkAndSendReminders();
    console.log('   Skipped actual reminder sending for safety');
    console.log('');

    console.log('✅ All tests completed successfully!');
    console.log('\n📋 To enable transaction reminders for a user:');
    console.log('   1. Go to Settings > Preferences in the app');
    console.log('   2. Toggle "Transaction Reminders" switch');
    console.log('   3. Connect WhatsApp integration');
    console.log('\n⏰ Reminders will be sent daily at 8:00 PM (Asia/Jakarta timezone)');
    console.log('   Or you can trigger manually via API: POST /api/reminders/trigger-transaction-reminders');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTransactionReminders().then(() => {
    console.log('\n🎯 Test completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testTransactionReminders };
