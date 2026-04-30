
-- ============================================
-- ADD COLUMNS TO PROFILES
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'cancelled', 'expired'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completion INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'veteran', 'ambassador'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'guest' CHECK (role IN ('guest', 'member'));

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  plan TEXT NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly')),
  amount NUMERIC(10,2) NOT NULL DEFAULT 120.00,
  currency TEXT DEFAULT 'ILS',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  payment_method_last4 TEXT,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- REFERRALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_phone TEXT,
  referred_email TEXT,
  referred_user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'subscribed')),
  month_year TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users create referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_month ON public.referrals(referrer_id, month_year);

-- ============================================
-- PROFILE COMPLETION CALCULATOR
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_profile_completion(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  completion INTEGER := 0;
  u RECORD;
BEGIN
  SELECT * INTO u FROM public.profiles WHERE user_id = p_user_id;

  IF u.first_name IS NOT NULL AND LENGTH(u.first_name) >= 2 THEN
    completion := completion + 10;
  END IF;

  IF u.date_of_birth IS NOT NULL THEN
    completion := completion + 10;
  END IF;

  IF u.gender IS NOT NULL THEN
    completion := completion + 10;
  END IF;

  IF u.photos IS NOT NULL AND array_length(u.photos, 1) >= 1 THEN
    completion := completion + 20;
  END IF;

  IF u.occupation IS NOT NULL AND LENGTH(u.occupation) >= 2 THEN
    completion := completion + 10;
  END IF;

  IF u.bio IS NOT NULL AND LENGTH(u.bio) >= 1 THEN
    completion := completion + 15;
  END IF;

  IF u.interests IS NOT NULL AND array_length(u.interests, 1) >= 5 THEN
    completion := completion + 25;
  END IF;

  UPDATE public.profiles SET profile_completion = completion WHERE user_id = p_user_id;

  RETURN completion;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- AUTO-UPDATE PROFILE COMPLETION TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_update_profile_completion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_completion := public.calculate_profile_completion(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_profile_completion ON public.profiles;
CREATE TRIGGER trigger_profile_completion
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_profile_completion();

-- ============================================
-- VOTE SCORE CALCULATOR
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_vote_score(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  positive INTEGER;
  negative INTEGER;
BEGIN
  SELECT COUNT(*) INTO positive
  FROM public.event_votes
  WHERE votee_id = p_user_id AND vote = 'clicked';

  SELECT COUNT(*) INTO negative
  FROM public.event_votes
  WHERE votee_id = p_user_id AND vote = 'no_click';

  RETURN COALESCE(positive, 0) - COALESCE(negative, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- EVENTS THIS MONTH COUNTER
-- ============================================
CREATE OR REPLACE FUNCTION public.count_events_this_month(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.event_registrations er
  JOIN public.events e ON er.event_id = e.id
  WHERE er.user_id = p_user_id
  AND er.status IN ('registered', 'approved')
  AND e.date >= date_trunc('month', CURRENT_DATE)
  AND e.date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  RETURN COALESCE(cnt, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- REFERRALS THIS MONTH COUNTER
-- ============================================
CREATE OR REPLACE FUNCTION public.count_referrals_this_month(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.referrals
  WHERE referrer_id = p_user_id
  AND month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

  RETURN COALESCE(cnt, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- STORAGE BUCKET FOR PHOTOS
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public photo access" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "Users upload own photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
