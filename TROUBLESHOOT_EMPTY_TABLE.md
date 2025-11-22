# Troubleshooting: Table Shows No Records in Consolidated Data View

## Problem
You have a table `clean_currency_exchange_rates` in Supabase with 1 record, but it shows as empty in the Consolidated Data view.

## Most Likely Causes

### 1. **Row Level Security (RLS) Mismatch** ⚠️ MOST COMMON
The record exists in the database, but RLS policies are filtering it out because:
- The `user_id` in the record doesn't match your current logged-in user ID
- RLS policies require `user_id = auth.uid()` to view records
- The record was created by a different user or during testing

**How to Check:**
```sql
-- Run in Supabase SQL Editor
SELECT 
    id,
    user_id,
    user_id = auth.uid() as is_my_record,
    auth.uid() as current_user_id
FROM public.clean_currency_exchange_rates;
```

**Expected Output:**
- If `is_my_record` is `false`, that's your problem!

**Fix Options:**

**Option A: Update the user_id to match your current user** (Recommended)
```sql
-- Get your current user ID
SELECT auth.uid();

-- Update the record to belong to you
UPDATE public.clean_currency_exchange_rates
SET user_id = auth.uid()
WHERE id = '<your-record-id>';
```

**Option B: Temporarily disable RLS for testing** (Not recommended for production)
```sql
ALTER TABLE public.clean_currency_exchange_rates DISABLE ROW LEVEL SECURITY;
```

**Option C: Add a global read policy** (Use with caution)
```sql
CREATE POLICY "Allow read access for authenticated users"
ON public.clean_currency_exchange_rates
FOR SELECT
TO authenticated
USING (true);
```

---

### 2. **Table Doesn't Exist**
The table `clean_currency_exchange_rates` might not have been created yet.

**How to Check:**
```sql
SELECT tablename 
FROM pg_tables 
WHERE tablename = 'clean_currency_exchange_rates';
```

**If Empty:** Run the `RECREATE_CLEAN_TABLES.sql` script to create all schema tables.

---

### 3. **Schema Not Loaded in Frontend**
The schema "currency_exchange_rates" might not be in the ExcelContext.

**How to Check:**
1. Open browser DevTools → Console
2. Look for: `"No table name provided"` or `"Querying table: clean_currency_exchange_rates"`

**If you see "No table name provided":**
- The schema is not loaded in the frontend
- Go to Project Config → Create the schema "currency_exchange_rates"
- Reload Consolidated Data page

---

### 4. **Authentication Issue**
You might not be logged in, or the session expired.

**How to Check:**
Open browser DevTools → Console, look for:
- `"User not authenticated"`
- `"No active session found"`

**Fix:**
- Log out and log back in
- Check if the Supabase auth token is valid

---

### 5. **Query Error Not Displayed**
The query might be failing silently.

**How to Check:**
Open browser DevTools → Console, look for:
- `"Error fetching from table"`
- Error details with code and message

**Common Errors:**
- `PGRST116`: Table doesn't exist
- `42501`: Permission denied (RLS issue)
- `42P01`: Relation does not exist

---

## Step-by-Step Diagnosis

### Step 1: Run Diagnostic SQL
Copy and run `DIAGNOSTIC_CURRENCY_TABLE.sql` in Supabase SQL Editor.

### Step 2: Check Browser Console
1. Open Consolidated Data page
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Look for logs from `useSupabaseSchemaTable.ts`

**Expected Logs:**
```
Querying table: clean_currency_exchange_rates for all users
Session valid, executing query...
Records fetched: 0 from clean_currency_exchange_rates
```

### Step 3: Check Network Tab
1. Open DevTools → Network tab
2. Filter for "clean_currency_exchange_rates"
3. Click on the request
4. Check:
   - **Status Code**: Should be 200
   - **Response**: Should contain data array
   - **Headers**: Check if Authorization header is present

### Step 4: Verify RLS Policies
```sql
-- Check existing policies
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'clean_currency_exchange_rates';
```

**Expected Policies:**
```
Policy Name: Users can view their own records
Command: SELECT
Qual: (user_id = auth.uid())
```

---

## Quick Fixes

### Fix 1: Update Record Owner (If RLS Mismatch)
```sql
-- Run this in SQL Editor
UPDATE public.clean_currency_exchange_rates
SET user_id = auth.uid();
```

### Fix 2: Add Missing RLS Policy (If No Policies Exist)
```sql
-- Create SELECT policy
CREATE POLICY "Users can view their own records"
ON public.clean_currency_exchange_rates
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create INSERT policy
CREATE POLICY "Users can create their own records"
ON public.clean_currency_exchange_rates
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create UPDATE policy  
CREATE POLICY "Users can update their own records"
ON public.clean_currency_exchange_rates
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Create DELETE policy
CREATE POLICY "Users can delete their own records"
ON public.clean_currency_exchange_rates
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
```

### Fix 3: Recreate Table (If Table Missing or Corrupted)
Run `RECREATE_CLEAN_TABLES.sql` to recreate all schema tables with proper structure and policies.

---

## Prevention

To avoid this issue in the future:

1. **Always set user_id when inserting records:**
   ```sql
   INSERT INTO clean_currency_exchange_rates (user_id, ...)
   VALUES (auth.uid(), ...);
   ```

2. **Test RLS policies after creating tables:**
   ```sql
   -- Test as authenticated user
   SELECT * FROM clean_currency_exchange_rates;
   ```

3. **Use the ExcelContext functions** which automatically set user_id:
   ```typescript
   saveDataToCleanTable(schemaId, data, workbookName, mappingId);
   ```

4. **Check console logs** during development to catch auth/RLS issues early

---

## Related Files

- **Frontend Hook**: `src/hooks/useSupabaseSchemaTable.ts`
- **Component**: `src/components/consolidated/SchemaTableWrapper.tsx`
- **Page**: `src/pages/ConsolidatedData.tsx`
- **Diagnostic SQL**: `DIAGNOSTIC_CURRENCY_TABLE.sql`
- **Table Recreation**: `RECREATE_CLEAN_TABLES.sql`

---

## Still Not Working?

If you've tried all the above and it's still not working:

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard
   - Click "Logs" → "Postgres Logs"
   - Look for errors related to your table

2. **Verify Table Structure:**
   ```sql
   \d public.clean_currency_exchange_rates
   ```

3. **Test with Direct SQL:**
   ```sql
   -- As superuser (bypasses RLS)
   SELECT * FROM public.clean_currency_exchange_rates;
   
   -- As authenticated user (with RLS)
   SELECT * FROM clean_currency_exchange_rates;
   ```

4. **Check for Typos:**
   - Schema name: "currency_exchange_rates"
   - Table name: "clean_currency_exchange_rates"
   - Case sensitivity matters!

5. **Verify RECREATE_CLEAN_TABLES.sql was run:**
   - Check if the table creation SQL includes this schema
   - Re-run the script if needed
