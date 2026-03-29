-- Migration: add is_mock column to all tables that need demo/live separation
-- Run once against the existing database before restarting the app.
--   psql $DATABASE_URL -f scripts/add_is_mock_columns.sql

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE agent_decisions
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE expertise_map
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;
