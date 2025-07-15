-- Migration: Add metadata column to budgets table
-- Created: 2025-07-15
-- Description: Add metadata TEXT column to store spending limits configuration as JSON

ALTER TABLE budgets ADD COLUMN metadata TEXT;
