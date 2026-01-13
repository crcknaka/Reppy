-- Consolidate app_logs RLS policies to fix performance warnings
-- Problem: Multiple permissive policies for same role/action

-- Drop ALL existing policies on app_logs
DROP POLICY IF EXISTS "Admins can read logs" ON public.app_logs;
DROP POLICY IF EXISTS "Admins can delete logs" ON public.app_logs;
DROP POLICY IF EXISTS "Admins can read and delete logs" ON public.app_logs;
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.app_logs;
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.app_logs;

-- Create clean, optimized policies:

-- 1. SELECT: Only admins can read logs
CREATE POLICY "Admins can select logs" ON public.app_logs
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IN (
    SELECT id FROM public.profiles WHERE is_admin = true
  )
);

-- 2. INSERT: Any authenticated user can insert logs
CREATE POLICY "Users can insert logs" ON public.app_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. DELETE: Only admins can delete logs
CREATE POLICY "Admins can delete logs" ON public.app_logs
FOR DELETE
TO authenticated
USING (
  (SELECT auth.uid()) IN (
    SELECT id FROM public.profiles WHERE is_admin = true
  )
);
