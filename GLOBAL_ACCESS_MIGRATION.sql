-- ============================================
-- MIGRATION: Make schemas, mappings, business_context, and clean tables globally accessible
-- Chat sessions and messages remain user-specific
-- 
-- Run this SQL in your Supabase SQL Editor to apply changes
-- ============================================

-- ============================================
-- ENSURE user_id COLUMNS EXIST
-- ============================================

-- Add user_id to schemas if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'schemas' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.schemas ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id to mappings if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mappings' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.mappings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id to business_context if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_context' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.business_context ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id to clean_data if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clean_data' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.clean_data ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id to dashboards if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'dashboards' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.dashboards ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id to dashboard_charts if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'dashboard_charts' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.dashboard_charts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- UPDATE RLS ON ALL DYNAMIC CLEAN_* TABLES
-- ============================================

-- This will update RLS policies on all existing clean_* tables
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
    -- Drop old user-specific SELECT policy if exists
    policy_name := table_rec.tablename || '_select_policy';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_rec.tablename);
    
    -- Create new global read policy
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR SELECT
      TO authenticated
      USING (true)
    ', policy_name, table_rec.tablename);
    
    -- Drop old INSERT policy if exists
    policy_name := table_rec.tablename || '_insert_policy';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_rec.tablename);
    
    -- Create user-specific INSERT policy
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id)
    ', policy_name, table_rec.tablename);
    
    -- Drop old UPDATE policy if exists
    policy_name := table_rec.tablename || '_update_policy';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_rec.tablename);
    
    -- Create user-specific UPDATE policy
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
    ', policy_name, table_rec.tablename);
    
    -- Drop old DELETE policy if exists
    policy_name := table_rec.tablename || '_delete_policy';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_rec.tablename);
    
    -- Create user-specific DELETE policy
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id)
    ', policy_name, table_rec.tablename);
    
    RAISE NOTICE 'Updated RLS policies for table: %', table_rec.tablename;
  END LOOP;
END $$;

-- ============================================
-- SCHEMAS TABLE - Global read, user-specific write
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own schemas" ON schemas;
DROP POLICY IF EXISTS "Users can create their own schemas" ON schemas;
DROP POLICY IF EXISTS "Users can update their own schemas" ON schemas;
DROP POLICY IF EXISTS "Users can delete their own schemas" ON schemas;

-- New policies: All authenticated users can read, only owner can modify
CREATE POLICY "All authenticated users can view schemas"
ON schemas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create schemas"
ON schemas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schemas"
ON schemas FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schemas"
ON schemas FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- MAPPINGS TABLE - Global read, user-specific write
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own mappings" ON mappings;
DROP POLICY IF EXISTS "Users can create their own mappings" ON mappings;
DROP POLICY IF EXISTS "Users can update their own mappings" ON mappings;
DROP POLICY IF EXISTS "Users can delete their own mappings" ON mappings;

-- New policies: All authenticated users can read, only owner can modify
CREATE POLICY "All authenticated users can view mappings"
ON mappings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create mappings"
ON mappings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mappings"
ON mappings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mappings"
ON mappings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- BUSINESS_CONTEXT TABLE - Global read, user-specific write
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own business context" ON business_context;
DROP POLICY IF EXISTS "Users can create their own business context" ON business_context;
DROP POLICY IF EXISTS "Users can update their own business context" ON business_context;
DROP POLICY IF EXISTS "Users can delete their own business context" ON business_context;

-- New policies: All authenticated users can read, only owner can modify
CREATE POLICY "All authenticated users can view business context"
ON business_context FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create business context"
ON business_context FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business context"
ON business_context FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business context"
ON business_context FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- CLEAN_DATA TABLE - Global read, user-specific write
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own clean data" ON clean_data;
DROP POLICY IF EXISTS "Users can create their own clean data" ON clean_data;
DROP POLICY IF EXISTS "Users can update their own clean data" ON clean_data;
DROP POLICY IF EXISTS "Users can delete their own clean data" ON clean_data;

-- New policies: All authenticated users can read, only owner can modify
CREATE POLICY "All authenticated users can view clean data"
ON clean_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create clean data"
ON clean_data FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clean data"
ON clean_data FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clean data"
ON clean_data FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- DASHBOARDS TABLE - Global read, user-specific write
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can create their own dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can update their own dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can delete their own dashboards" ON dashboards;

-- New policies: All authenticated users can read, only owner can modify
CREATE POLICY "All authenticated users can view dashboards"
ON dashboards FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create dashboards"
ON dashboards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards"
ON dashboards FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards"
ON dashboards FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- DASHBOARD_CHARTS TABLE - Global read, user-specific write
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own dashboard charts" ON dashboard_charts;
DROP POLICY IF EXISTS "Users can create their own dashboard charts" ON dashboard_charts;
DROP POLICY IF EXISTS "Users can update their own dashboard charts" ON dashboard_charts;
DROP POLICY IF EXISTS "Users can delete their own dashboard charts" ON dashboard_charts;

-- New policies: All authenticated users can read, only owner can modify
CREATE POLICY "All authenticated users can view dashboard charts"
ON dashboard_charts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create dashboard charts"
ON dashboard_charts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard charts"
ON dashboard_charts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard charts"
ON dashboard_charts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- NOTE: Dynamic clean_* tables
-- ============================================
-- The RLS policies for dynamically created clean_* tables (e.g., clean_hotel_bookings)
-- are now handled by the updated manage-schema-table edge function.
-- Any new tables created will have global read access by default.
-- 
-- For existing clean_* tables, you may need to manually update their policies.
-- Example for a table named clean_hotel_bookings:
--
-- DROP POLICY IF EXISTS "Users can view their own data" ON clean_hotel_bookings;
-- CREATE POLICY "All authenticated users can view data" 
--   ON clean_hotel_bookings FOR SELECT 
--   TO authenticated
--   USING (true);
