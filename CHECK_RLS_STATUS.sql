-- ========================================================
-- CHECK CURRENT RLS POLICIES  
-- Run this to see what policies are currently active
-- ========================================================

-- Check policies for main tables
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
AND tablename IN ('schemas', 'business_context', 'mappings', 'clean_data', 'chat_sessions', 'chat_messages')
ORDER BY tablename, policyname;

-- Check policies for dynamic clean_* tables
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE 'clean_%'
ORDER BY tablename, policyname;

-- Check which tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('schemas', 'business_context', 'mappings', 'clean_data')
OR tablename LIKE 'clean_%'
ORDER BY tablename;