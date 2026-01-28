-- Add expires_at column to workout_shares table
ALTER TABLE workout_shares
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');

-- Update existing shares to have expiration (30 days from creation)
UPDATE workout_shares
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Make expires_at NOT NULL after updating existing records
ALTER TABLE workout_shares
ALTER COLUMN expires_at SET NOT NULL;

-- Create index for faster expiration queries
CREATE INDEX IF NOT EXISTS idx_workout_shares_expires_at ON workout_shares(expires_at);

-- Create function to clean up expired shares (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.workout_shares
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_expired_shares() TO authenticated;
