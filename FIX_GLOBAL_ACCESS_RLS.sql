-- Fix RLS policies for global read access to schemas and RPC functions
-- Run this SQL in your Supabase SQL Editor

-- 1. Enable RLS on schemas table if not already enabled
ALTER TABLE "public"."schemas" ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing SELECT policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "authenticated_users_can_read_all_schemas" ON "public"."schemas";
DROP POLICY IF EXISTS "Users can read own schemas" ON "public"."schemas";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."schemas";

-- 3. Create new policy: All authenticated users can read ALL schemas
CREATE POLICY "authenticated_users_can_read_all_schemas" 
ON "public"."schemas"
FOR SELECT 
TO authenticated
USING (true);

-- 4. Allow authenticated users to use the RPC functions
GRANT EXECUTE ON FUNCTION sanitize_table_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;

-- 5. If you have business_context table, also allow global read access
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_context') THEN
    ALTER TABLE "public"."business_context" ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "authenticated_users_can_read_all_business_context" ON "public"."business_context";
    
    CREATE POLICY "authenticated_users_can_read_all_business_context" 
    ON "public"."business_context"
    FOR SELECT 
    TO authenticated
    USING (true);
  END IF;
END $$;

-- 6. Verify the policies were created
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('schemas', 'business_context')
ORDER BY tablename, policyname;
