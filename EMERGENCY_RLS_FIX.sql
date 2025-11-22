-- ========================================================
-- EMERGENCY RLS FIX FOR CROSS-USER ACCESS
-- Run this SQL directly in your Supabase SQL Editor
-- ========================================================

-- This will immediately fix the RLS issues preventing cross-user access to business data

-- 1. Drop restrictive policies and create global read access for schemas
DROP POLICY IF EXISTS "Users can view their own schemas" ON public.schemas;
CREATE POLICY "global_read_schemas" ON public.schemas FOR SELECT TO authenticated USING (true);

-- 2. Drop restrictive policies and create global read access for business_context  
DROP POLICY IF EXISTS "Users can view their own business context" ON public.business_context;
CREATE POLICY "global_read_business_context" ON public.business_context FOR SELECT TO authenticated USING (true);

-- 3. Drop restrictive policies and create global read access for mappings
DROP POLICY IF EXISTS "Users can view their own mappings" ON public.mappings;
CREATE POLICY "global_read_mappings" ON public.mappings FOR SELECT TO authenticated USING (true);

-- 4. Drop restrictive policies and create global read access for clean_data
DROP POLICY IF EXISTS "Users can view their own clean data" ON public.clean_data;
CREATE POLICY "global_read_clean_data" ON public.clean_data FOR SELECT TO authenticated USING (true);

-- 5. Fix all dynamic clean_* tables to have global read access
DO $$
DECLARE
  table_rec RECORD;
  policy_name TEXT;
BEGIN
  FOR table_rec IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename LIKE 'clean_%'
  LOOP
    -- Drop restrictive SELECT policies
    EXECUTE format('DROP POLICY IF EXISTS "Users can view their own data" ON public.%I', table_rec.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_policy" ON public.%I', table_rec.tablename, table_rec.tablename);
    
    -- Create global read policy
    policy_name := 'global_read_' || table_rec.tablename;
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR SELECT
      TO authenticated
      USING (true)
    ', policy_name, table_rec.tablename);
    
    RAISE NOTICE 'Fixed global read access for table: %', table_rec.tablename;
  END LOOP;
END $$;

-- 6. Verify policies were created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('schemas', 'business_context', 'mappings', 'clean_data')
OR tablename LIKE 'clean_%'
ORDER BY tablename, policyname;

-- Success message
SELECT 'RLS policies updated for global business data access!' as status;