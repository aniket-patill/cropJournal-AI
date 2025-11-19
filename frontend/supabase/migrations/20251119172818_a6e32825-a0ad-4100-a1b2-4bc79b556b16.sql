-- Create enum for activity types
CREATE TYPE public.activity_type AS ENUM (
  'organic_input',
  'water_conservation',
  'soil_health',
  'pest_management',
  'crop_rotation',
  'other'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  crop_name TEXT,
  activity_type activity_type NOT NULL,
  credits_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Create rewards table
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  credits_cost INTEGER NOT NULL,
  image_url TEXT,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Create redemptions table
CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  credits_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for activities
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

-- RLS Policies for rewards (public read)
CREATE POLICY "Anyone can view available rewards"
  ON public.rewards FOR SELECT
  USING (available = TRUE);

-- RLS Policies for redemptions
CREATE POLICY "Users can view their own redemptions"
  ON public.redemptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own redemptions"
  ON public.redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to calculate user credits
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

-- Insert some sample rewards
INSERT INTO public.rewards (title, description, credits_cost, available) VALUES
  ('Premium Seeds Package', 'High-quality organic seeds for various crops', 500, TRUE),
  ('Soil Testing Kit', 'Complete kit for analyzing soil health and nutrients', 300, TRUE),
  ('Eco-Friendly Fertilizer', '10kg bag of organic fertilizer', 400, TRUE),
  ('Drip Irrigation System', 'Water-efficient irrigation system for small farms', 800, TRUE),
  ('Farming Tools Set', 'Essential hand tools for sustainable farming', 600, TRUE),
  ('Agricultural Training Course', 'Online course on sustainable farming practices', 1000, TRUE);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();