-- Migration for WhatsApp Multi-Account Integration
-- Create whatsapp_integrations table
CREATE TABLE whatsapp_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    display_name TEXT,
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, whatsapp_number) -- Prevent duplicate connections
);

-- Create whatsapp_activation_codes table
CREATE TABLE whatsapp_activation_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Create indexes for performance
CREATE INDEX idx_whatsapp_integrations_user_id ON whatsapp_integrations(user_id);
CREATE INDEX idx_whatsapp_integrations_number ON whatsapp_integrations(whatsapp_number);
CREATE INDEX idx_whatsapp_activation_codes_user_id ON whatsapp_activation_codes(user_id);
CREATE INDEX idx_whatsapp_activation_codes_code ON whatsapp_activation_codes(code);
CREATE INDEX idx_whatsapp_activation_codes_expires_at ON whatsapp_activation_codes(expires_at);
