-- ============================================
-- FIX: Allow all authenticated users full CRUD access to dashboards and charts
-- ============================================

-- ============================================
-- DASHBOARDS TABLE - Full access for all authenticated users
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can update their own dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can delete their own dashboards" ON dashboards;

-- Create new policies: All authenticated users can modify any dashboard
CREATE POLICY "All authenticated users can update dashboards"
ON dashboards FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "All authenticated users can delete dashboards"
ON dashboards FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- DASHBOARD_CHARTS TABLE - Full access for all authenticated users
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can update their own dashboard charts" ON dashboard_charts;
DROP POLICY IF EXISTS "Users can delete their own dashboard charts" ON dashboard_charts;

-- Create new policies: All authenticated users can modify any chart
CREATE POLICY "All authenticated users can update dashboard charts"
ON dashboard_charts FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "All authenticated users can delete dashboard charts"
ON dashboard_charts FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- Verification
-- ============================================
SELECT 
  tablename, 
  policyname, 
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('dashboards', 'dashboard_charts')
ORDER BY tablename, policyname;
