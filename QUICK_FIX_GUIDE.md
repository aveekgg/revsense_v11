# 🚨 QUICK FIX: manage-schema-table 500 Error

## Error You're Seeing
```
POST https://...supabase.co/functions/v1/manage-schema-table 500 (Internal Server Error)
Edge Function returned a non-2xx status code
```

## ✅ Solution (3 Steps)

### Step 1: Run the Complete Fix SQL
1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file: **`COMPLETE_FIX_RUN_THIS_NOW.sql`**
4. Click **Run** (or press Cmd/Ctrl + Enter)

This will:
- ✅ Create all 4 required database functions
- ✅ Grant proper permissions
- ✅ Test each function
- ✅ Show verification results

### Step 2: Verify Functions Created
After running the SQL, you should see:
```
✅✅✅ ALL FUNCTIONS CREATED AND TESTED SUCCESSFULLY ✅✅✅
```

The 4 functions created:
1. `sanitize_table_name(TEXT)` - Sanitizes table names
2. `get_table_columns(TEXT)` - Gets table structure
3. `execute_ddl(TEXT)` - Executes CREATE/ALTER/DROP
4. `execute_safe_query(TEXT)` - Executes SELECT queries

### Step 3: Try Your Mapping Again
1. Go back to your app
2. Navigate to **Add Data** tab
3. Load your workbook
4. Apply the mapping
5. Click **Save to Clean Table**

It should now work! ✅

---

## 🔍 If Still Failing

### Check Edge Function Logs
1. Go to **Supabase Dashboard**
2. Navigate to **Functions** (left sidebar)
3. Click on **manage-schema-table**
4. Click **Logs** tab
5. Look for specific error messages

### Common Issues & Fixes

#### Issue: "permission denied for function X"
**Fix**: The SQL script grants permissions automatically. If still seeing this:
```sql
GRANT EXECUTE ON FUNCTION public.sanitize_table_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO authenticated;
```

#### Issue: "function X does not exist"
**Fix**: Re-run `COMPLETE_FIX_RUN_THIS_NOW.sql`

#### Issue: "table clean_X already exists"
**Fix**: The function uses `CREATE TABLE IF NOT EXISTS`, so this shouldn't happen. If it does:
```sql
-- Drop and recreate
DROP TABLE IF EXISTS public.clean_your_table_name CASCADE;
```
Then try mapping again.

#### Issue: "schema.fields is not iterable"
**Fix**: Check that your schema has fields defined:
```javascript
// In browser console:
console.log(schema.fields);
```
Should show an array of field objects.

---

## 📊 What Happens Behind the Scenes

When you click "Save to Clean Table":

```
1. Frontend (ExcelContext.tsx)
   ↓
   Calls: supabase.functions.invoke('manage-schema-table', {
     operation: 'update',
     schemaName: 'Your Schema',
     fields: [...]
   })

2. Edge Function (manage-schema-table)
   ↓
   Calls: sanitize_table_name('Your Schema')
   Returns: 'your_schema'
   ↓
   Calls: get_table_columns('clean_your_schema')
   Returns: existing columns
   ↓
   Builds ALTER TABLE SQL to add/remove columns
   ↓
   Calls: execute_ddl(ALTER_TABLE_SQL)
   ↓
   Returns: { success: true, tableName: 'clean_your_schema' }

3. Frontend
   ↓
   Calls: supabase.functions.invoke('insert-clean-data', {
     tableName: 'clean_your_schema',
     data: {...}
   })
   ↓
   Success! Data inserted ✅
```

---

## 🐛 Advanced Debugging

### Test Functions Manually

```sql
-- Test 1: Sanitize a table name
SELECT sanitize_table_name('My Revenue Data!');
-- Expected: my_revenue_data_

-- Test 2: Check if table exists
SELECT * FROM get_table_columns('clean_hotel_revenue');
-- Expected: List of columns or empty if table doesn't exist

-- Test 3: Create a test table
SELECT execute_ddl('
  CREATE TABLE IF NOT EXISTS public.test_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_column TEXT
  );
');
-- Expected: {"success": true}

-- Test 4: Run a safe query
SELECT execute_safe_query('SELECT * FROM schemas LIMIT 1');
-- Expected: JSON array with schema data
```

### Check Function Permissions

```sql
SELECT 
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'sanitize_table_name',
    'get_table_columns', 
    'execute_ddl',
    'execute_safe_query'
  )
ORDER BY routine_name, grantee;
```

### View Edge Function Environment

Edge functions need these environment variables:
- `SUPABASE_URL` (auto-set)
- `SUPABASE_ANON_KEY` (auto-set)
- `OPENAI_API_KEY` (for AI functions, not needed for manage-schema-table)

Check: **Supabase Dashboard → Settings → Edge Functions → Secrets**

---

## 📝 Files Reference

| File | Purpose |
|------|---------|
| `COMPLETE_FIX_RUN_THIS_NOW.sql` | **Run this first** - Creates all functions |
| `FIX_MANAGE_SCHEMA_ERROR_NOW.sql` | Alternative fix (similar) |
| `DIAGNOSE_MANAGE_SCHEMA_ERROR.sql` | Diagnostic queries |
| `CREATE_REQUIRED_FUNCTIONS.sql` | Original function creation script |
| `FUNCTION_PERMISSIONS_FIX.sql` | Permission fixes |
| `EDGE_AND_DATABASE_FUNCTIONS_GUIDE.md` | Complete architecture guide |

---

## ✅ Success Checklist

After running the fix, verify:

- [ ] SQL script completed without errors
- [ ] Saw "ALL FUNCTIONS CREATED AND TESTED SUCCESSFULLY"
- [ ] All 4 functions exist (run verification query)
- [ ] All functions have `authenticated` permission
- [ ] Mapping operation now works
- [ ] Data appears in your clean table

---

## 🆘 Still Need Help?

If you've tried everything above and still getting errors:

1. **Copy the exact error message** from browser console
2. **Check Supabase edge function logs** for backend errors
3. **Run diagnostic script**: `DIAGNOSE_MANAGE_SCHEMA_ERROR.sql`
4. **Share results** - I can help debug further

The most common cause is missing database functions or permissions - the `COMPLETE_FIX_RUN_THIS_NOW.sql` script fixes 99% of cases! 🎯
