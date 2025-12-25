import { storage } from './storage';
import { sendSingleBotMessage } from './whatsapp-single-bot';

/**
 * Budget Alert Service
 * 
 * This service checks all user budgets and sends WhatsApp notifications
 * when budgets are at warning level (80%+) or over budget (100%+).
 */

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

interface BudgetAlertService {
    checkAllBudgetsAndSendAlerts(): Promise<void>;
    checkUserBudgets(userId: string): Promise<void>;
}

class BudgetAlertServiceImpl implements BudgetAlertService {

    /**
     * Check all users' budgets and send alerts where needed
     */
    async checkAllBudgetsAndSendAlerts(): Promise<void> {
        console.log('🔔 Starting budget alerts check...');

        try {
            // Get all users with budget alerts enabled
            const usersWithAlerts = await storage.getUsersWithBudgetAlerts();

            console.log(`Found ${usersWithAlerts.length} users with budget alerts enabled`);

            for (const user of usersWithAlerts) {
                try {
                    await this.checkUserBudgets(user.id);
                } catch (error) {
                    console.error(`❌ Error checking budgets for user ${user.id}:`, error);
                }
            }

            console.log('✅ Budget alerts check completed');
        } catch (error) {
            console.error('❌ Error in budget alerts check:', error);
        }
    }

    /**
     * Check all budgets for a specific user and send alerts
     */
    async checkUserBudgets(userId: string): Promise<void> {
        try {
            // Get user preferences
            const userPrefs = await storage.getUserPreferences(userId);
            if (!userPrefs?.budgetAlerts) {
                return; // Budget alerts disabled
            }

            // Get user's WhatsApp integrations
            const integrations = await storage.getUserWhatsAppIntegrations(userId);
            const activeIntegrations = integrations.filter(i => i.status === 'active');

            if (activeIntegrations.length === 0) {
                return; // No WhatsApp connected
            }

            // Get all active budgets for user
            const budgets = await storage.getBudgets(userId);
            const activeBudgets = budgets.filter(b => b.isActive);

            const currencySymbol = getCurrencySymbol(userPrefs.defaultCurrency || 'IDR');
            const alertMessages: string[] = [];

            for (const budget of activeBudgets) {
                // Calculate spent amount in current period
                const spent = await storage.getSpentInPeriod(userId, budget.categoryId, budget.startDate, budget.endDate);
                const percentage = (spent / budget.amount) * 100;

                // Check if alert is needed
                if (percentage >= 100) {
                    alertMessages.push(
                        `🚨 *${budget.category?.name || 'Unknown'}* - OVER BUDGET!\n` +
                        `   💰 Budget: ${currencySymbol}${budget.amount.toLocaleString()}\n` +
                        `   💸 Spent: ${currencySymbol}${spent.toLocaleString()} (${percentage.toFixed(1)}%)\n` +
                        `   ⚠️ Over by: ${currencySymbol}${(spent - budget.amount).toLocaleString()}`
                    );
                } else if (percentage >= 80) {
                    alertMessages.push(
                        `⚠️ *${budget.category?.name || 'Unknown'}* - Warning!\n` +
                        `   💰 Budget: ${currencySymbol}${budget.amount.toLocaleString()}\n` +
                        `   💸 Spent: ${currencySymbol}${spent.toLocaleString()} (${percentage.toFixed(1)}%)\n` +
                        `   💵 Remaining: ${currencySymbol}${(budget.amount - spent).toLocaleString()}`
                    );
                }
            }

            if (alertMessages.length === 0) {
                return; // No alerts needed
            }

            // Compose full message
            const fullMessage = `📊 *Budget Status Report*\n\n${alertMessages.join('\n\n')}\n\n_Stay mindful of your spending!_`;

            // Send to all connected WhatsApp numbers
            for (const integration of activeIntegrations) {
                try {
                    await sendSingleBotMessage(integration.whatsappNumber, fullMessage);

                    // Log the notification
                    await storage.createNotificationLog({
                        userId,
                        type: 'budget_alert',
                        whatsappNumber: integration.whatsappNumber,
                        message: fullMessage,
                        status: 'sent',
                        sentAt: Math.floor(Date.now() / 1000),
                    });

                    console.log(`✅ Budget alert sent to ${integration.whatsappNumber}`);
                } catch (error) {
                    console.error(`❌ Failed to send budget alert to ${integration.whatsappNumber}:`, error);

                    await storage.createNotificationLog({
                        userId,
                        type: 'budget_alert',
                        whatsappNumber: integration.whatsappNumber,
                        message: fullMessage,
                        status: 'failed',
                        sentAt: Math.floor(Date.now() / 1000),
                        errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        } catch (error) {
            console.error(`❌ Error checking budgets for user ${userId}:`, error);
        }
    }
}

export const budgetAlertService = new BudgetAlertServiceImpl();
