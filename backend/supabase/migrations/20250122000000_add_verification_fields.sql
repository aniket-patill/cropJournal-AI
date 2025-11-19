-- Migration to add verification and anti-fraud fields to activities table

-- Add location fields
ALTER TABLE public.activities 
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(5, 2);

-- Add verification fields
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_metadata JSONB,
  ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT FALSE;

-- Add index for location queries
CREATE INDEX IF NOT EXISTS idx_activities_location ON public.activities(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_activities_verification ON public.activities(verification_status, fraud_score);
CREATE INDEX IF NOT EXISTS idx_activities_flagged ON public.activities(flagged_for_review) WHERE flagged_for_review = TRUE;

-- Add index for timestamp-based queries (for frequency validation)
CREATE INDEX IF NOT EXISTS idx_activities_user_created ON public.activities(user_id, created_at);

