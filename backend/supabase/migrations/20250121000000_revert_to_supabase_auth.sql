-- Migration to revert from Clerk TEXT IDs back to Supabase UUID auth.users

-- Step 1: Drop existing foreign key constraints
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;
ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_user_id_fkey;

-- Step 2: Revert profiles table to UUID (references auth.users)
-- Drop the current profiles table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Recreate profiles table with UUID id
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Update activities table - change user_id back to UUID
ALTER TABLE public.activities 
  ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- Step 4: Update redemptions table - change user_id back to UUID
ALTER TABLE public.redemptions 
  ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- Step 5: Recreate foreign key constraints
ALTER TABLE public.activities
  ADD CONSTRAINT activities_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.redemptions
  ADD CONSTRAINT redemptions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Step 6: Recreate profile trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
  );
  RETURN NEW;
END;
$$;

-- Step 7: Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 8: Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Step 9: Recreate RLS Policies
-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Activities policies
CREATE POLICY "Users can view their own activities"
  ON public.activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities"
  ON public.activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities"
  ON public.activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
  ON public.activities FOR DELETE
  USING (auth.uid() = user_id);

-- Redemptions policies
CREATE POLICY "Users can view their own redemptions"
  ON public.redemptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own redemptions"
  ON public.redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Rewards policies (public read)
CREATE POLICY "Anyone can view available rewards"
  ON public.rewards FOR SELECT
  USING (available = TRUE);

-- Step 10: Update get_user_credits function to accept UUID
CREATE OR REPLACE FUNCTION public.get_user_credits(p_user_id UUID)
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

