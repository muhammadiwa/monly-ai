-- Migration: Add Goal Boosts and Savings Plans Tables
-- Created: 2025-07-16
-- Description: Add tables to support goal boost functionality and recurring savings plans

-- Goal boosts table - records one-time contributions to goals
CREATE TABLE IF NOT EXISTS goal_boosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    date INTEGER NOT NULL,
    description TEXT,
    created_at INTEGER,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Goal savings plans - automatic recurring contributions to goals
CREATE TABLE IF NOT EXISTS goal_savings_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    next_contribution_date INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_goal_boosts_goal_id ON goal_boosts(goal_id);
CREATE INDEX idx_goal_boosts_user_id ON goal_boosts(user_id);
CREATE INDEX idx_goal_savings_plans_goal_id ON goal_savings_plans(goal_id);
CREATE INDEX idx_goal_savings_plans_user_id ON goal_savings_plans(user_id);
CREATE INDEX idx_goal_savings_plans_next_contribution ON goal_savings_plans(next_contribution_date);
