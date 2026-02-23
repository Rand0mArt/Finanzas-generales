-- Migration to add missing metadata columns to transactions table
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS is_fixed boolean default false,
  ADD COLUMN IF NOT EXISTS is_recurring boolean default false,
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS notes text;
