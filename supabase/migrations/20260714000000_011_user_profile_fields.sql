-- ============================================================
-- Migration 011: User Profile Fields
-- Adds nickname and avatar_url to the users table so users can
-- personalise their display name and profile picture.
-- Both columns are nullable — existing rows get NULL by default.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Grant is already set on the users table from the base schema;
-- no additional grants required.
