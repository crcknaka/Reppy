-- Fix RLS policy performance for app_logs table
-- Use (SELECT auth.uid()) instead of auth.uid() to avoid per-row evaluation

-- Drop old policies
DROP POLICY IF EXISTS "Admins can delete logs" ON public.app_logs;
DROP POLICY IF EXISTS "Admins can read/delete logs" ON public.app_logs;
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.app_logs;

-- Create optimized policy for admins (read/delete)
CREATE POLICY "Admins can read and delete logs" ON public.app_logs
FOR ALL
TO authenticated
USING (
  (SELECT auth.uid()) IN (
    SELECT id FROM public.profiles WHERE is_admin = true
  )
);

-- Keep the authenticated insert policy
-- (it should already exist as "Authenticated users can insert logs")

-- Fix function search_path
ALTER FUNCTION public.cleanup_old_logs() SET search_path = public;
