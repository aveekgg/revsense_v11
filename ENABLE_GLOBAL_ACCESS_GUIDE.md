# Enable Global Access to Clean Tables

## What You Want
All authenticated users should be able to see **ALL records** in clean tables, not just their own.

## Current Behavior
❌ User A can only see records where `user_id = User A's ID`  
❌ User B can only see records where `user_id = User B's ID`  
❌ This is due to Row Level Security (RLS) policies

## Desired Behavior
✅ User A can see **all records** (from User A, User B, User C, etc.)  
✅ User B can see **all records** (from User A, User B, User C, etc.)  
✅ Perfect for team collaboration!

**Security Note**: Users can still only **edit/delete their own** records.

---

## Solution: Run This SQL

### Step 1: Go to Supabase SQL Editor
1. Visit: https://supabase.com/dashboard/project/djskqegnpplmnyrzomri
2. Click **"SQL Editor"** in left sidebar
3. Click **"+ New query"**

### Step 2: Run the Migration
Open the file: **`ENABLE_GLOBAL_CLEAN_TABLES.sql`**

Copy the entire contents and paste into SQL Editor, then click **"Run"**.

### Step 3: Verify Success
You should see output like:
```
✓ clean_data table updated
✓ Updated: clean_currency_exchange_rates
✓ Updated: clean_hotel_bookings
...

========================================
SUCCESS: Updated 5 clean tables
========================================

📊 SUMMARY:
   Total clean tables: 5
   With global access: 5

✅ ALL TABLES NOW HAVE GLOBAL READ ACCESS!

   What this means:
   • Any logged-in user can see ALL records
   • Users can still only edit their own records
   • Perfect for team collaboration!
```

### Step 4: Refresh Your App
Go back to your app and refresh the **Consolidated Data** page. You should now see all records from all users!

---

## Alternative: Use Existing Migration

If you prefer, you can also run the comprehensive migration:
- File: **`GLOBAL_ACCESS_MIGRATION.sql`**
- This updates not just clean tables, but also schemas, mappings, business_context, and dashboards
- Same steps: Copy → Paste → Run in SQL Editor

---

## What Changes

### Before (Restrictive RLS)
```sql
CREATE POLICY "Users can view their own records"
ON clean_currency_exchange_rates
FOR SELECT
USING (user_id = auth.uid());  -- ❌ Only see your own
```

### After (Global RLS)
```sql
CREATE POLICY "Everyone can view all records"
ON clean_currency_exchange_rates
FOR SELECT
USING (true);  -- ✅ See everyone's records
```

---

## Security Impact

### What's Allowed ✅
- **READ**: All users can view all records
- **Collaboration**: Teams can see each other's data
- **Transparency**: Everyone sees the same data

### What's Still Protected 🔒
- **CREATE**: Users can only insert records with their own `user_id`
- **UPDATE**: Users can only modify their own records
- **DELETE**: Users can only delete their own records
- **Authentication**: Must be logged in to access anything

---

## Affected Tables

This migration updates RLS policies on:

1. `clean_data` (main table)
2. All schema-specific tables:
   - `clean_currency_exchange_rates`
   - `clean_hotel_bookings`
   - `clean_revenue_summary`
   - Any other `clean_*` tables

---

## Reverting (Making Tables Private Again)

If you need to revert back to user-specific access:

```sql
-- Revert clean_data
DROP POLICY IF EXISTS "Everyone can view all clean data" ON public.clean_data;
CREATE POLICY "Users can view their own clean data"
ON public.clean_data
FOR SELECT
USING (user_id = auth.uid());

-- Revert schema tables
DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename LIKE 'clean_%'
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Everyone can view all records" ON public.%I;
      CREATE POLICY "Users can view their own records"
      ON public.%I
      FOR SELECT
      USING (user_id = auth.uid())
    ', tbl.tablename, tbl.tablename);
  END LOOP;
END $$;
```

---

## Troubleshooting

### Still can't see other users' records?
1. **Check the migration ran successfully** - Look for "SUCCESS" message
2. **Verify policies were updated**:
   ```sql
   SELECT tablename, policyname, qual
   FROM pg_policies
   WHERE tablename = 'clean_currency_exchange_rates' AND cmd = 'SELECT';
   ```
   Should show `qual = true`

3. **Clear browser cache** and refresh
4. **Re-login** to get fresh auth token

### Error: "policy already exists"?
The script handles this automatically with `DROP POLICY IF EXISTS`. If you still get errors, manually drop the policy first:
```sql
DROP POLICY "<policy-name>" ON clean_currency_exchange_rates;
```

---

## Files Reference

- **`ENABLE_GLOBAL_CLEAN_TABLES.sql`** - Simple focused fix for clean tables only
- **`GLOBAL_ACCESS_MIGRATION.sql`** - Comprehensive migration for all tables
- **`FIX_GLOBAL_ACCESS_RLS.sql`** - Legacy fix for schemas/business_context

Choose whichever file matches your needs. The simplest is `ENABLE_GLOBAL_CLEAN_TABLES.sql`.
