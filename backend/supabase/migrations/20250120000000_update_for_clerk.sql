-- Migration to update schema for Clerk user IDs and new activity fields

-- Step 1: Drop existing RLS policies that depend on auth.users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can view their own redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Users can create their own redemptions" ON public.redemptions;

-- Step 2: Drop the trigger that auto-creates profiles (we'll handle this in backend)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 3: Update profiles table - change id from UUID to TEXT
-- First, drop foreign key constraints that reference profiles.id
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;
ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_user_id_fkey;

-- Create new profiles table with TEXT id
CREATE TABLE IF NOT EXISTS public.profiles_new (
  id TEXT PRIMARY KEY,
  full_name TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing data if any (convert UUID to TEXT)
INSERT INTO public.profiles_new (id, full_name, language, created_at, updated_at)
SELECT id::TEXT, full_name, language, created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- Drop old table and rename new one
DROP TABLE IF EXISTS public.profiles CASCADE;
ALTER TABLE public.profiles_new RENAME TO profiles;

-- Step 4: Update activities table - add new fields and change user_id to TEXT
ALTER TABLE public.activities 
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS transcription TEXT,
  ADD COLUMN IF NOT EXISTS activity_metadata JSONB;

-- Update user_id to TEXT if it's UUID
ALTER TABLE public.activities 
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Step 5: Update redemptions table - change user_id to TEXT
ALTER TABLE public.redemptions 
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Step 6: Recreate foreign key constraints
ALTER TABLE public.activities
  ADD CONSTRAINT activities_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.redemptions
  ADD CONSTRAINT redemptions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Step 7: Update get_user_credits function to accept TEXT
CREATE OR REPLACE FUNCTION public.get_user_credits(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_earned INTEGER;
  total_spent INTEGER;
BEGIN
  SELECT COALESCE(SUM(credits_earned), 0) INTO total_earned
  FROM public.activities
  WHERE user_id = p_user_id;
  
  SELECT COALESCE(SUM(credits_spent), 0) INTO total_spent
  FROM public.redemptions
  WHERE user_id = p_user_id;
  
  RETURN total_earned - total_spent;
END;
$$;

-- Step 8: Disable RLS (we'll handle authorization in the backend)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards DISABLE ROW LEVEL SECURITY;

