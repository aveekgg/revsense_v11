# Quick Schema Export Guide (No Tools Required)

Since you're getting errors with the Supabase CLI and don't have pg_dump installed, here's the **fastest method** using only the Supabase Dashboard:

## Method: Export Schema via SQL Editor (5 minutes)

### Step 1: Generate Schema Export SQL

1. Go to your **old project**: https://supabase.com/dashboard/project/djskqegnpplmnyrzomri
2. Click **SQL Editor** → **New Query**
3. **Copy and paste this SQL** (it will generate all CREATE statements):

```sql
-- This query generates a complete schema export
SELECT 
  string_agg(
    'CREATE TABLE ' || table_name || ' (' || 
    (
      SELECT string_agg(
        column_name || ' ' || 
        CASE 
          WHEN data_type = 'USER-DEFINED' THEN udt_name
          WHEN data_type = 'ARRAY' THEN udt_name
          ELSE data_type 
        END ||
        CASE 
          WHEN character_maximum_length IS NOT NULL 
          THEN '(' || character_maximum_length || ')'
          ELSE ''
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE 
          WHEN column_default IS NOT NULL 
          THEN ' DEFAULT ' || column_default
          ELSE ''
        END,
        ', '
      )
      FROM information_schema.columns c2
      WHERE c2.table_schema = c.table_schema
        AND c2.table_name = c.table_name
    ) || 
    ');',
    E'\n\n'
  ) as create_statements
FROM information_schema.columns c
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
GROUP BY table_schema, table_name
ORDER BY table_name;
```

4. Click **Run** (or press Cmd+Enter)
5. **Copy the output** - this is your schema!

### Step 2: Export Functions

Run this query to get all your functions:

```sql
SELECT 
  'CREATE OR REPLACE FUNCTION ' || 
  routine_schema || '.' || routine_name || 
  '(' || 
  COALESCE(
    (
      SELECT string_agg(
        parameter_name || ' ' || 
        CASE 
          WHEN data_type = 'USER-DEFINED' THEN udt_name
          ELSE data_type
        END,
        ', '
      )
      FROM information_schema.parameters
      WHERE specific_schema = r.specific_schema
        AND specific_name = r.specific_name
        AND parameter_mode = 'IN'
    ),
    ''
  ) ||
  ')' || E'\n' ||
  'RETURNS ' || 
  CASE 
    WHEN data_type = 'USER-DEFINED' THEN type_udt_name
    ELSE data_type
  END || E'\n' ||
  'LANGUAGE ' || external_language || E'\n' ||
  CASE 
    WHEN security_type = 'DEFINER' THEN 'SECURITY DEFINER' || E'\n'
    ELSE ''
  END ||
  'AS $$' || E'\n' ||
  routine_definition || E'\n' ||
  '$$;' as function_definition
FROM information_schema.routines r
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

Copy the output.

### Step 3: Export RLS Policies

Run this query:

```sql
SELECT 
  'CREATE POLICY "' || policyname || '" ON ' || 
  schemaname || '.' || tablename || E'\n' ||
  'FOR ' || cmd || E'\n' ||
  'TO ' || roles || E'\n' ||
  'USING (' || qual || ')' ||
  CASE 
    WHEN with_check IS NOT NULL 
    THEN E'\nWITH CHECK (' || with_check || ')'
    ELSE ''
  END || ';' as policy_definition
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Copy the output.

### Step 4: Save Everything

Create a file called `schema_export.sql` and combine all three outputs:

```sql
-- Tables
[Paste output from Step 1]

-- Functions  
[Paste output from Step 2]

-- RLS Policies
[Paste output from Step 3]
```

### Step 5: Import to New Project

1. Create your new Supabase project
2. Go to **SQL Editor** → **New Query**
3. Paste the entire `schema_export.sql` content
4. Click **Run**

Done! ✅

---

## Alternative: Wait for PostgreSQL Installation

If you prefer using command-line tools, wait for the `brew install postgresql@15` to finish (currently running in background), then use:

```bash
# After installation completes, add to PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Then run pg_dump
pg_dump "postgresql://postgres.djskqegnpplmnyrzomri:[YOUR_PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" \
  --schema-only \
  --no-owner \
  --no-acl \
  --exclude-schema=auth \
  --exclude-schema=storage \
  -f schema_export.sql
```

---

## Which Method Should You Use?

- **SQL Editor Method** (above): ✅ Works immediately, no installation needed
- **pg_dump Method**: ✅ More complete, but requires waiting for installation

I recommend the **SQL Editor method** for now since it's instant!
