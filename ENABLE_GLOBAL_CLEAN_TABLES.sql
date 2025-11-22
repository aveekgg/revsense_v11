-- ============================================================================
-- ENABLE GLOBAL READ ACCESS FOR ALL CLEAN TABLES
-- ============================================================================
--
-- PURPOSE: Allow all authenticated users to see ALL records in clean tables
--
-- BEFORE: Users could only see their own records (WHERE user_id = auth.uid())
-- AFTER:  Users can see everyone's records (WHERE true)
--
-- SECURITY: Users can still only CREATE/UPDATE/DELETE their own records
--
-- HOW TO USE:
-- 1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/djskqegnpplmnyrzomri
-- 2. SQL Editor → New Query
-- 3. Copy/paste this entire file
-- 4. Click "Run" (Cmd+Enter)
-- ============================================================================

-- Step 1: Update the main clean_data table
DO $$
BEGIN
  -- Drop old restrictive policy
  DROP POLICY IF EXISTS "Users can view their own clean data" ON public.clean_data;
  DROP POLICY IF EXISTS "All authenticated users can view clean data" ON public.clean_data;
  
  -- Create new global read policy
  CREATE POLICY "Everyone can view all clean data"
  ON public.clean_data
  FOR SELECT
  TO authenticated
  USING (true);
  
  RAISE NOTICE '✓ clean_data table updated';
END $$;

-- Step 2: Update ALL schema-specific clean_* tables
DO $$
DECLARE
  tbl_record record;
  policy_count integer := 0;
BEGIN
  -- Loop through every clean_* table
  FOR tbl_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename LIKE 'clean_%'
    AND tablename != 'clean_data'
  LOOP
    BEGIN
      -- Drop all possible variations of old policies
      EXECUTE format('DROP POLICY IF EXISTS "Users can view their own data" ON public.%I', tbl_record.tablename);
      EXECUTE format('DROP POLICY IF EXISTS "Users can view their own records" ON public.%I', tbl_record.tablename);
      EXECUTE format('DROP POLICY IF EXISTS "All authenticated users can view data" ON public.%I', tbl_record.tablename);
      EXECUTE format('DROP POLICY IF EXISTS "All authenticated users can view records" ON public.%I', tbl_record.tablename);
      EXECUTE format('DROP POLICY IF EXISTS "All authenticated users can view all records" ON public.%I', tbl_record.tablename);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl_record.tablename || '_select_policy', tbl_record.tablename);
      
      -- Create new global read policy
      EXECUTE format('
        CREATE POLICY "Everyone can view all records"
        ON public.%I
        FOR SELECT
        TO authenticated
        USING (true)
      ', tbl_record.tablename);
      
      policy_count := policy_count + 1;
      RAISE NOTICE '✓ Updated: %', tbl_record.tablename;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠ Error updating %: %', tbl_record.tablename, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SUCCESS: Updated % clean tables', policy_count + 1; -- +1 for clean_data
  RAISE NOTICE '========================================';
END $$;

-- Step 3: Verify changes
SELECT 
    tablename,
    policyname,
    CASE 
        WHEN qual::text = 'true' THEN '✅ GLOBAL'
        WHEN qual::text LIKE '%auth.uid()%' THEN '⚠️  RESTRICTED'
        ELSE '❓ ' || left(qual::text, 30)
    END as access_level,
    cmd as operation
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename LIKE 'clean_%'
  AND cmd = 'SELECT'
ORDER BY tablename;

-- Step 4: Final message
DO $$
DECLARE
  global_count integer;
  total_count integer;
BEGIN
  SELECT COUNT(*) INTO global_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename LIKE 'clean_%'
    AND cmd = 'SELECT'
    AND qual::text = 'true';
    
  SELECT COUNT(DISTINCT tablename) INTO total_count
  FROM pg_tables
  WHERE schemaname = 'public' 
    AND tablename LIKE 'clean_%';
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 SUMMARY:';
  RAISE NOTICE '   Total clean tables: %', total_count;
  RAISE NOTICE '   With global access: %', global_count;
  RAISE NOTICE '';
  
  IF global_count = total_count THEN
    RAISE NOTICE '✅ ALL TABLES NOW HAVE GLOBAL READ ACCESS!';
    RAISE NOTICE '';
    RAISE NOTICE '   What this means:';
    RAISE NOTICE '   • Any logged-in user can see ALL records';
    RAISE NOTICE '   • Users can still only edit their own records';
    RAISE NOTICE '   • Perfect for team collaboration!';
    RAISE NOTICE '';
    RAISE NOTICE '   Next step: Refresh your Consolidated Data page';
  ELSE
    RAISE NOTICE '⚠️  Some tables may need manual updating';
  END IF;
  
  RAISE NOTICE '';
END $$;
