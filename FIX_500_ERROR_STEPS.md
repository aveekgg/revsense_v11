# 🔧 Fix 500 Error - Step by Step

You're still getting a 500 error after running the SQL. Here's what to do:

## Step 1: Deploy Updated Edge Function

The edge function code has been updated with better error handling. You need to deploy it to Supabase.

### Option A: Deploy via Supabase CLI (Recommended)

```bash
# Install Supabase CLI if you haven't
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link your project (find project ref in Supabase dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the updated edge function
supabase functions deploy manage-schema-table
```

### Option B: Deploy via Supabase Dashboard

1. Go to **Supabase Dashboard** → **Functions**
2. Click on **manage-schema-table**
3. Click **Edit Function**
4. Copy the entire contents of `/supabase/functions/manage-schema-table/index.ts`
5. Paste it in the editor
6. Click **Deploy**

## Step 2: Check Edge Function Logs

After deploying, check the logs to see the actual error:

1. Go to **Supabase Dashboard**
2. Navigate to **Functions** → **manage-schema-table**
3. Click **Logs** tab
4. Try the mapping operation again
5. Watch the logs in real-time

Look for lines like:
- `"Error in manage-schema-table"` - Shows what went wrong
- `"Error sanitizing table name"` - Database function issue
- `"Error fetching current columns"` - Permission issue
- `"Error updating table"` - DDL execution issue

## Step 3: What Changed

### Frontend (`ExcelContext.tsx`)
Now maps `schema.fields` to the simpler format expected by edge function:

```typescript
// Before (was sending full SchemaField):
fields: schema.fields  // Has id, displayLabel, etc.

// After (only sends what edge function needs):
fields: schema.fields.map(f => ({
  name: f.name,
  type: f.type,
  required: f.required
}))
```

### Edge Function (`manage-schema-table/index.ts`)
Now returns detailed error information:

```typescript
// Now includes:
{
  success: false,
  error: "specific error message",
  details: "stack trace",
  timestamp: "2025-11-22T..."
}
```

## Step 4: Test Again

1. **Reload your app** (hard refresh: Cmd+Shift+R / Ctrl+Shift+F5)
2. **Open browser console** (F12 or Cmd+Option+I)
3. **Try the mapping operation**
4. **Check console** - you should see more detailed error info now

## Step 5: Common Issues & Solutions

### Issue: "Table name cannot be null or empty"
**Cause**: Schema name is missing or invalid  
**Fix**: Check that your schema has a valid name in the database

### Issue: "Failed to sanitize table name"
**Cause**: `sanitize_table_name` function is still missing  
**Fix**: Re-run `COMPLETE_FIX_RUN_THIS_NOW.sql`

### Issue: "Failed to fetch table columns"
**Cause**: `get_table_columns` function missing or no permission  
**Fix**: 
```sql
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;
```

### Issue: "Failed to update table: permission denied"
**Cause**: `execute_ddl` function lacks permissions  
**Fix**:
```sql
GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO service_role;
```

### Issue: "relation clean_X does not exist"
**Cause**: Table hasn't been created yet, trying to update non-existent table  
**Fix**: Change operation to 'create' first, then 'update'

## Step 6: Manual Testing

Test the database functions directly in Supabase SQL Editor:

```sql
-- Test 1: Can you sanitize a table name?
SELECT sanitize_table_name('My Schema Name');
-- Expected: my_schema_name

-- Test 2: Can you execute DDL?
SELECT execute_ddl('
  CREATE TABLE IF NOT EXISTS public.test_edge_fix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test TEXT
  );
');
-- Expected: {"success": true}

-- Test 3: Can you get columns?
SELECT * FROM get_table_columns('test_edge_fix');
-- Expected: Single row with test column

-- Clean up
DROP TABLE IF EXISTS public.test_edge_fix CASCADE;
```

If ANY of these fail, the edge function will fail too.

## Step 7: Alternative Quick Fix

If you can't deploy the edge function, you can work around it:

### Option 1: Create Table Manually

```sql
-- Replace 'your_schema_name' with your actual schema name
CREATE TABLE IF NOT EXISTS public.clean_your_schema_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_workbook TEXT,
  source_mapping_id UUID,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  -- Add your schema fields here
  field1 TEXT,
  field2 NUMERIC(12,2),
  field3 DATE
  -- etc.
);

-- Enable RLS
ALTER TABLE public.clean_your_schema_name ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All authenticated users can view data" 
  ON public.clean_your_schema_name FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own data" 
  ON public.clean_your_schema_name FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### Option 2: Skip Table Sync (temporary)

Comment out the sync call in `ExcelContext.tsx` (lines 407-423):

```typescript
// TEMPORARY: Comment this out for testing
/*
const { data: tableResult, error: tableError } = await supabase.functions.invoke('manage-schema-table', {
  body: {
    operation: 'update',
    schemaId: schema.id,
    schemaName: schema.name,
    fields: fieldsForEdgeFunction,
  },
});
*/

// Skip directly to insert
const tableName = `clean_${schema.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')}`;
```

## Step 8: Get More Help

If still stuck, share:

1. **Edge function logs** (from Supabase Dashboard)
2. **Browser console errors** (full error object)
3. **Schema structure** (from browser console: `console.log(schema)`)
4. **Result of manual tests** (Step 6 above)

This will help diagnose the exact issue! 🔍
