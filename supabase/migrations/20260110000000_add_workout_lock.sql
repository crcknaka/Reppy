-- Add is_locked column to workouts table
ALTER TABLE workouts ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;

-- Add index for better query performance on locked workouts
CREATE INDEX idx_workouts_is_locked ON workouts(is_locked);
