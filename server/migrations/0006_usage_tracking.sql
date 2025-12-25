-- Usage Tracking Table Migration
-- This migration adds the usage_tracking table for tracking feature usage per user

CREATE TABLE usage_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  feature TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, feature, period)
);

-- Create index for performance optimization
CREATE INDEX idx_usage_tracking_user_period ON usage_tracking(user_id, period);
