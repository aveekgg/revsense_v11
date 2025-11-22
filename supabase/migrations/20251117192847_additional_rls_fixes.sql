-- Additional RLS fixes for global read access to schemas and RPC functions
-- This complements the main global access migration

-- 1. Enable RLS on schemas table if not already enabled
ALTER TABLE "public"."schemas" ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing SELECT policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "authenticated_users_can_read_all_schemas" ON "public"."schemas";
DROP POLICY IF EXISTS "Users can read own schemas" ON "public"."schemas";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."schemas";

-- 3. Create new policy: All authenticated users can read ALL schemas (backup policy)
CREATE POLICY "authenticated_users_can_read_all_schemas" 
ON "public"."schemas"
FOR SELECT 
TO authenticated
USING (true);

-- 4. If you have business_context table, also allow global read access (backup policy)
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

-- 5. Ensure clean_data has global read access (backup policy)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clean_data') THEN
    ALTER TABLE "public"."clean_data" ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "authenticated_users_can_read_all_clean_data" ON "public"."clean_data";
    
    CREATE POLICY "authenticated_users_can_read_all_clean_data" 
    ON "public"."clean_data"
    FOR SELECT 
    TO authenticated
    USING (true);
  END IF;
END $$;

-- 6. Ensure mappings has global read access (backup policy)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mappings') THEN
    ALTER TABLE "public"."mappings" ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "authenticated_users_can_read_all_mappings" ON "public"."mappings";
    
    CREATE POLICY "authenticated_users_can_read_all_mappings" 
    ON "public"."mappings"
    FOR SELECT 
    TO authenticated
    USING (true);
  END IF;
END $$;
