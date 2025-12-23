-- Admin Panel Tables Migration
-- This migration adds all tables required for the Admin Panel feature

-- Admin users table
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  last_login INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Subscription plans table
CREATE TABLE subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly REAL NOT NULL,
  price_yearly REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  features TEXT NOT NULL,
  limits TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- User subscriptions table
CREATE TABLE user_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL,
  start_date INTEGER NOT NULL,
  end_date INTEGER NOT NULL,
  auto_renew INTEGER DEFAULT 1,
  cancelled_at INTEGER,
  cancellation_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Payments table
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  subscription_id INTEGER REFERENCES user_subscriptions(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  midtrans_transaction_id TEXT,
  midtrans_order_id TEXT UNIQUE,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Invoices table
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  payment_id INTEGER REFERENCES payments(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  items TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  issued_at INTEGER NOT NULL,
  due_at INTEGER NOT NULL,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- System settings table
CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  data_type TEXT NOT NULL,
  description TEXT,
  updated_by TEXT REFERENCES admin_users(id),
  updated_at INTEGER NOT NULL
);

-- Admin activity log table
CREATE TABLE admin_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT NOT NULL REFERENCES admin_users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at INTEGER NOT NULL
);

-- Midtrans webhook logs table
CREATE TABLE midtrans_webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  transaction_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  signature TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

-- Create indexes for performance optimization
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_midtrans_order_id ON payments(midtrans_order_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_admin_activity_logs_admin_id ON admin_activity_logs(admin_id);
CREATE INDEX idx_admin_activity_logs_created_at ON admin_activity_logs(created_at);

-- Add subscription-related fields to users table
ALTER TABLE users ADD COLUMN subscription_plan_id INTEGER REFERENCES subscription_plans(id);
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'free';
