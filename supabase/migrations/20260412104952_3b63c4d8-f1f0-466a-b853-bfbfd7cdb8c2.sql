
-- ============================================
-- EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location_name TEXT NOT NULL,
  location_address TEXT,
  location_url TEXT,
  host_id UUID REFERENCES auth.users(id),
  max_capacity INTEGER NOT NULL DEFAULT 40,
  reserved_new_spots INTEGER NOT NULL DEFAULT 10,
  gender_balance_target NUMERIC(3,2) DEFAULT 0.50,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'almost_full', 'full', 'past', 'cancelled')),
  is_past_voting_open BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EVENT REGISTRATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'registered', 'waitlist', 'cancelled')),
  waitlist_position INTEGER,
  paid_amount NUMERIC(10,2),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ============================================
-- POST-EVENT VOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.event_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  votee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('clicked', 'didnt_talk', 'no_click')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, voter_id, votee_id)
);

-- ============================================
-- EVENT PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.event_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_events_date ON public.events(date DESC);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_registrations_event ON public.event_registrations(event_id);
CREATE INDEX idx_registrations_user ON public.event_registrations(user_id);
CREATE INDEX idx_votes_event ON public.event_votes(event_id);
CREATE INDEX idx_photos_event ON public.event_photos(event_id);

-- ============================================
-- AUTO-UPDATE EVENT STATUS TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_event_status()
RETURNS TRIGGER AS $$
DECLARE
  registered_count INTEGER;
  event_capacity INTEGER;
BEGIN
  SELECT COUNT(*) INTO registered_count
  FROM public.event_registrations
  WHERE event_id = NEW.event_id
  AND status IN ('registered', 'approved');
  
  SELECT max_capacity INTO event_capacity
  FROM public.events
  WHERE id = NEW.event_id;
  
  IF registered_count >= event_capacity THEN
    UPDATE public.events SET status = 'full', updated_at = NOW()
    WHERE id = NEW.event_id AND status NOT IN ('past', 'cancelled');
  ELSIF registered_count >= (event_capacity * 0.8) THEN
    UPDATE public.events SET status = 'almost_full', updated_at = NOW()
    WHERE id = NEW.event_id AND status NOT IN ('full', 'past', 'cancelled');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_event_status
AFTER INSERT OR UPDATE ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.update_event_status();

-- ============================================
-- AUTO-SET PAST EVENTS FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_past_events()
RETURNS void AS $$
BEGIN
  UPDATE public.events
  SET status = 'past', updated_at = NOW()
  WHERE date < CURRENT_DATE
  AND status NOT IN ('past', 'cancelled');
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- UPDATED_AT TRIGGER FOR EVENTS
-- ============================================
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Events: everyone authenticated can read
CREATE POLICY "Events are viewable by authenticated users" ON public.events
  FOR SELECT TO authenticated USING (true);

-- Event registrations: users can view their own
CREATE POLICY "Users can view own registrations" ON public.event_registrations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Event registrations: users can view registrations for events they're registered to
CREATE POLICY "Users can view co-attendee registrations" ON public.event_registrations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.event_registrations er
      WHERE er.event_id = event_registrations.event_id
      AND er.user_id = auth.uid()
      AND er.status IN ('registered', 'approved')
    )
  );

-- Event registrations: users can insert their own
CREATE POLICY "Users can create own registrations" ON public.event_registrations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Event votes: users can view their own votes
CREATE POLICY "Users can view own votes" ON public.event_votes
  FOR SELECT TO authenticated USING (auth.uid() = voter_id);

-- Event votes: users can create their own votes
CREATE POLICY "Users can create votes" ON public.event_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);

-- Event photos: everyone authenticated can view
CREATE POLICY "Photos are viewable by authenticated users" ON public.event_photos
  FOR SELECT TO authenticated USING (true);

-- Event photos: authenticated users can upload
CREATE POLICY "Authenticated users can upload photos" ON public.event_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
