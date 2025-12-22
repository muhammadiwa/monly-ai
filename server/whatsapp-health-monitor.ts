/**
 * WhatsApp Health Monitor
 * Monitors WhatsApp bot connection and auto-recovers from failures
 */

import { getSingleBotConnectionState, reconnectSingleWhatsAppBot } from './whatsapp-single-bot';

export class WhatsAppHealthMonitor {
    private checkInterval: NodeJS.Timeout | null = null;
    private failureCount = 0;
    private readonly MAX_FAILURES = 3;
    private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
    private lastHealthCheck: Date | null = null;
    private isRecovering = false;

    /**
     * Start health monitoring
     */
    start() {
        if (this.checkInterval) {
            console.log('⚠️ Health monitor already running');
            return;
        }

        console.log('🏥 Starting WhatsApp health monitor...');
        console.log(`📊 Check interval: ${this.CHECK_INTERVAL / 1000 / 60} minutes`);

        // Initial check after 1 minute
        setTimeout(() => this.checkHealth(), 60 * 1000);

        // Regular checks
        this.checkInterval = setInterval(() => {
            this.checkHealth();
        }, this.CHECK_INTERVAL);
    }

    /**
     * Stop health monitoring
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('🛑 WhatsApp health monitor stopped');
        }
    }

    /**
     * Check WhatsApp bot health
     */
    private async checkHealth() {
        this.lastHealthCheck = new Date();
        const state = getSingleBotConnectionState();

        console.log(`🏥 Health check: ${state.status} (connected: ${state.connected})`);

        if (!state.connected && state.status !== 'initializing' && state.status !== 'qr_received') {
            this.failureCount++;
            console.warn(`⚠️ WhatsApp bot not connected (${this.failureCount}/${this.MAX_FAILURES})`);
            console.warn(`   Status: ${state.status}`);

            if (this.failureCount >= this.MAX_FAILURES && !this.isRecovering) {
                console.error('❌ WhatsApp bot failed health check. Attempting recovery...');
                await this.attemptRecovery();
            }
        } else {
            // Reset failure count on success
            if (this.failureCount > 0) {
                console.log('✅ WhatsApp bot recovered!');
            }
            this.failureCount = 0;
            this.isRecovering = false;
        }
    }

    /**
     * Attempt to recover WhatsApp bot connection
     */
    private async attemptRecovery() {
        if (this.isRecovering) {
            console.log('⏳ Recovery already in progress...');
            return;
        }

        this.isRecovering = true;

        try {
            console.log('🔄 Attempting to reconnect WhatsApp bot...');

            const result = await reconnectSingleWhatsAppBot();

            if (result.success) {
                console.log('✅ WhatsApp bot reconnected successfully!');
                this.failureCount = 0;
                this.isRecovering = false;
            } else {
                console.error('❌ Failed to reconnect WhatsApp bot:', result.message);
                // Will retry on next health check
                this.isRecovering = false;
            }
        } catch (error) {
            console.error('❌ Error during recovery:', error);
            this.isRecovering = false;
        }
    }

    /**
     * Get current health status
     */
    getStatus() {
        const state = getSingleBotConnectionState();

        return {
            connected: state.connected,
            status: state.status,
            failureCount: this.failureCount,
            maxFailures: this.MAX_FAILURES,
            lastCheck: this.lastHealthCheck,
            isRecovering: this.isRecovering,
            checkInterval: this.CHECK_INTERVAL / 1000 / 60, // in minutes
        };
    }
}

// Singleton instance
let healthMonitor: WhatsAppHealthMonitor | null = null;

export function getHealthMonitor(): WhatsAppHealthMonitor {
    if (!healthMonitor) {
        healthMonitor = new WhatsAppHealthMonitor();
    }
    return healthMonitor;
}
