-- Add transaction_reminders field to user_preferences table
ALTER TABLE user_preferences ADD COLUMN transaction_reminders INTEGER DEFAULT 1;

-- Create notification_logs table for tracking sent notifications
CREATE TABLE notification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    whatsapp_number TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    sent_at INTEGER NOT NULL,
    error_message TEXT,
    created_at INTEGER
);

-- Create indexes for notification_logs table
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_type ON notification_logs(type);
CREATE INDEX idx_notification_logs_sent_at ON notification_logs(sent_at);
