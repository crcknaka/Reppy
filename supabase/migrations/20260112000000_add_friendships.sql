-- Create friendships table for friend system
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- Create indexes for performance
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Function to check if two users are friends (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.are_friends(user1 UUID, user2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND ((requester_id = user1 AND addressee_id = user2)
      OR (requester_id = user2 AND addressee_id = user1))
  );
$$;

-- Function to get all friend IDs for a user
CREATE OR REPLACE FUNCTION public.get_friend_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN requester_id = user_uuid THEN addressee_id
    ELSE requester_id
  END
  FROM public.friendships
  WHERE status = 'accepted'
  AND (requester_id = user_uuid OR addressee_id = user_uuid);
$$;

-- RLS Policies for friendships table

-- Users can view their own friendships (sent or received)
CREATE POLICY "Users can view own friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can create friend requests from their own account
CREATE POLICY "Users can send friend requests"
ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = requester_id);

-- Users can update requests where they are the addressee (accept/reject)
CREATE POLICY "Users can respond to friend requests"
ON public.friendships FOR UPDATE
USING (auth.uid() = addressee_id)
WITH CHECK (auth.uid() = addressee_id);

-- Users can delete their own requests or accepted friendships they're part of
CREATE POLICY "Users can delete own friendships"
ON public.friendships FOR DELETE
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- RLS Policies for viewing friends' data

-- Friends can view each other's profiles
CREATE POLICY "Friends can view profiles"
ON public.profiles FOR SELECT
USING (public.are_friends(auth.uid(), user_id));

-- Friends can view each other's workouts
CREATE POLICY "Friends can view workouts"
ON public.workouts FOR SELECT
USING (public.are_friends(auth.uid(), user_id));

-- Friends can view each other's workout sets
CREATE POLICY "Friends can view workout sets"
ON public.workout_sets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = workout_sets.workout_id
    AND public.are_friends(auth.uid(), w.user_id)
  )
);

-- Trigger to update updated_at on friendships
CREATE OR REPLACE FUNCTION public.update_friendships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_friendships_updated_at();
