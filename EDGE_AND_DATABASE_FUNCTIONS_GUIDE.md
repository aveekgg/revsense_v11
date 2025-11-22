# Edge Functions & Database Functions - Complete Guide

## Overview

Your application uses two types of serverless functions:

1. **Edge Functions** - Deno-based serverless functions running on Supabase Edge Runtime
2. **Database Functions** - PostgreSQL functions (stored procedures) running in your Supabase database

## 🔷 Edge Functions (Deno TypeScript)

Edge functions are located in `/supabase/functions/` and run on Supabase's edge runtime (Deno).

### Available Edge Functions

#### 1. **ai-sql-orchestrator**
- **Location**: `supabase/functions/ai-sql-orchestrator/index.ts`
- **Purpose**: AI-powered SQL query generation and execution
- **Called from**: `src/hooks/useChatSession.ts`
- **Flow**:
  ```typescript
  // Frontend calls:
  const { data, error } = await supabase.functions.invoke('ai-sql-orchestrator', {
    body: { userQuery, sessionId, chatHistory }
  });
  ```
  
- **What it does**:
  1. Receives user's natural language query
  2. Fetches available schemas and table structures using database functions
  3. Calls OpenAI API to refine query intent
  4. Generates SQL in canonical long format (period, entity, metric)
  5. Executes SQL via `execute_safe_query` database function
  6. Returns results and summary

- **Dependencies**:
  - Database functions: `sanitize_table_name`, `get_table_columns`, `execute_safe_query`
  - Environment variables: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

#### 2. **insert-clean-data**
- **Location**: `supabase/functions/insert-clean-data/index.ts`
- **Purpose**: Bulk insert data into schema-specific clean tables
- **Called from**: 
  - `src/hooks/useBatchProcessor.ts`
  - `src/contexts/ExcelContext.tsx`
  
- **Flow**:
  ```typescript
  const { data, error } = await supabase.functions.invoke('insert-clean-data', {
    body: { tableName, data, sourceWorkbook, sourceMappingId }
  });
  ```

- **What it does**:
  1. Validates table name format (must start with `clean_`)
  2. Verifies table exists
  3. Adds metadata (user_id, source info)
  4. Inserts data into the specified table

#### 3. **manage-schema-table**
- **Location**: `supabase/functions/manage-schema-table/index.ts`
- **Purpose**: Create, update, or delete schema-specific data tables
- **Called from**:
  - `src/hooks/useSupabaseSchemas.ts`
  - `src/contexts/ExcelContext.tsx`

- **Operations**:
  - **CREATE**: Creates new table with RLS policies
  - **UPDATE**: Adds/removes columns based on schema changes
  - **DELETE**: Drops table entirely

- **Flow**:
  ```typescript
  const { data, error } = await supabase.functions.invoke('manage-schema-table', {
    body: { 
      operation: 'create|update|delete',
      schemaName,
      fields: SchemaField[]
    }
  });
  ```

- **Dependencies**:
  - Database functions: `sanitize_table_name`, `get_table_columns`, `execute_ddl`

#### 4. **ai-chart-generator**
- **Location**: `supabase/functions/ai-chart-generator/index.ts`
- **Purpose**: Generate optimal chart configurations from query results
- **Called from**: `src/components/chat/ChatMessage.tsx`

- **Flow**:
  ```typescript
  const response = await supabase.functions.invoke('ai-chart-generator', {
    body: { queryResult, cleanedQuery, sqlQuery }
  });
  ```

- **What it does**:
  1. Analyzes canonical long-format data
  2. Detects metrics (absolute/percentage), entities, time grain
  3. Uses OpenAI to generate optimal Recharts configuration
  4. Returns chart config and processed data

#### 5. **ai-formula**
- **Location**: `supabase/functions/ai-formula/index.ts`
- **Purpose**: AI-powered formula computation
- **Called from**: `src/lib/formulaComputer.ts`

#### 6. **generate-session-title**
- **Location**: `supabase/functions/generate-session-title/index.ts`
- **Purpose**: Generate meaningful titles for chat sessions

---

## 🔶 Database Functions (PostgreSQL)

Database functions are SQL stored procedures running in PostgreSQL. They're defined in migration files and `CREATE_REQUIRED_FUNCTIONS.sql`.

### Core Database Functions

#### 1. **sanitize_table_name(TEXT)**
```sql
CREATE OR REPLACE FUNCTION public.sanitize_table_name(name TEXT)
RETURNS TEXT
```

- **Purpose**: Sanitize user input to create valid PostgreSQL table names
- **What it does**: Converts to lowercase, replaces special chars with underscores
- **Used by**: All edge functions that create/manage tables
- **Security**: `SECURITY DEFINER`, `SET search_path = public`

#### 2. **get_table_columns(TEXT)**
```sql
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name TEXT)
RETURNS TABLE (column_name TEXT, data_type TEXT, is_nullable TEXT)
```

- **Purpose**: Retrieve column metadata for a table
- **What it does**: Queries `information_schema.columns`, excludes system columns
- **Used by**: 
  - `ai-sql-orchestrator` (to understand table structure)
  - `manage-schema-table` (to detect column changes)

#### 3. **execute_safe_query(TEXT)**
```sql
CREATE OR REPLACE FUNCTION public.execute_safe_query(query_text TEXT)
RETURNS JSONB
```

- **Purpose**: Safely execute SELECT queries with validation
- **What it does**:
  1. Validates query starts with SELECT
  2. Blocks dangerous keywords (DELETE, INSERT, UPDATE, DROP, etc.)
  3. Executes query and returns results as JSONB
  4. Handles errors gracefully

- **Used by**: `ai-sql-orchestrator` to run AI-generated SQL
- **Security**: `SECURITY DEFINER`, read-only enforcement

#### 4. **execute_ddl(TEXT)**
```sql
CREATE OR REPLACE FUNCTION public.execute_ddl(ddl_statement TEXT)
RETURNS JSONB
```

- **Purpose**: Execute DDL statements (CREATE, ALTER, DROP tables)
- **What it does**:
  1. Executes the DDL statement
  2. Returns success/failure as JSONB
  3. Captures errors with details

- **Used by**: `manage-schema-table` for table operations
- **Security**: `SECURITY DEFINER` - requires careful permission management

---

## 🔄 How They Work Together

### Example Flow: User Asks a Question

```
1. User types question in chat
   ↓
2. Frontend (useChatSession.ts) calls edge function
   supabase.functions.invoke('ai-sql-orchestrator', {...})
   ↓
3. Edge function (ai-sql-orchestrator):
   a. Gets available schemas from database
   b. Calls sanitize_table_name() for each schema
   c. Calls get_table_columns() to understand structure
   d. Sends context to OpenAI API
   e. Receives generated SQL
   f. Calls execute_safe_query() to run SQL
   ↓
4. Database function execute_safe_query():
   a. Validates SQL is safe (SELECT only)
   b. Executes query against clean_* tables
   c. Returns results as JSONB
   ↓
5. Edge function processes results
   ↓
6. Returns to frontend with data + summary
```

### Example Flow: User Uploads Excel File

```
1. User uploads Excel file
   ↓
2. Frontend parses Excel, creates schema definition
   ↓
3. Calls manage-schema-table edge function (CREATE operation)
   supabase.functions.invoke('manage-schema-table', {
     operation: 'create',
     schemaName: 'Hotel Revenue',
     fields: [...]
   })
   ↓
4. Edge function (manage-schema-table):
   a. Calls sanitize_table_name('Hotel Revenue') → 'hotel_revenue'
   b. Builds CREATE TABLE SQL with fields
   c. Calls execute_ddl() to create table with RLS policies
   ↓
5. Database function execute_ddl():
   a. Executes CREATE TABLE clean_hotel_revenue (...)
   b. Creates indexes
   c. Enables RLS
   d. Creates policies
   ↓
6. Frontend then calls insert-clean-data edge function
   supabase.functions.invoke('insert-clean-data', {
     tableName: 'clean_hotel_revenue',
     data: {...}
   })
   ↓
7. Edge function inserts data row by row
```

---

## 🔐 Security & Permissions

### Edge Functions
- Use `Authorization` header from frontend request
- Authenticate user via `supabaseClient.auth.getUser()`
- Run with user's permissions

### Database Functions
- Set as `SECURITY DEFINER` - run with function owner's privileges
- Must have `SET search_path = public` to prevent injection
- Require explicit `GRANT EXECUTE` to `authenticated` role

### Required Grants
```sql
GRANT EXECUTE ON FUNCTION public.sanitize_table_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO authenticated;
```

---

## 🐛 Common Errors & Solutions

### Error: "permission denied for function X"
**Cause**: Database function not granted to authenticated users
**Solution**: Run `FUNCTION_PERMISSIONS_FIX.sql`

### Error: "function X does not exist"
**Cause**: Database function not created
**Solution**: Run `CREATE_REQUIRED_FUNCTIONS.sql`

### Error: "Unauthorized" from edge function
**Cause**: Missing or invalid auth token
**Solution**: Check that user is logged in, token is valid

### Error: "relation clean_X does not exist"
**Cause**: Table not created yet
**Solution**: Upload data first or check manage-schema-table ran successfully

### Error: "Only SELECT queries are allowed"
**Cause**: execute_safe_query rejecting non-SELECT query
**Solution**: Ensure AI is generating SELECT statements, check for CTEs starting with WITH

### Error: Edge function timeout
**Cause**: OpenAI API slow response or complex query
**Solution**: 
- Check OpenAI API status
- Simplify query
- Increase edge function timeout in config

---

## 📝 Environment Variables Required

Edge functions need these environment variables set in Supabase dashboard:

```bash
OPENAI_API_KEY=sk-...          # For AI functions
SUPABASE_URL=https://...       # Auto-populated
SUPABASE_ANON_KEY=eyJ...       # Auto-populated
```

Set via: **Supabase Dashboard → Project Settings → Edge Functions → Secrets**

---

## 🔧 Debugging

### Check Edge Function Logs
```bash
# In Supabase Dashboard:
Project → Functions → [function-name] → Logs

# Or via CLI:
supabase functions logs ai-sql-orchestrator
```

### Test Database Function
```sql
-- Test sanitize_table_name
SELECT sanitize_table_name('My Schema Name!'); 
-- Should return: my_schema_name_

-- Test get_table_columns
SELECT * FROM get_table_columns('clean_hotel_revenue');

-- Test execute_safe_query
SELECT execute_safe_query('SELECT * FROM schemas LIMIT 5');
```

### Verify Permissions
```sql
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'sanitize_table_name', 
    'get_table_columns', 
    'execute_safe_query', 
    'execute_ddl'
  );
```

---

## 📚 Key Files Reference

### Edge Functions
- `supabase/functions/ai-sql-orchestrator/index.ts` - Main AI query handler
- `supabase/functions/manage-schema-table/index.ts` - Table CRUD operations
- `supabase/functions/insert-clean-data/index.ts` - Data insertion
- `supabase/functions/ai-chart-generator/index.ts` - Chart config generation

### Database Functions
- `CREATE_REQUIRED_FUNCTIONS.sql` - Creates all required DB functions
- `FUNCTION_PERMISSIONS_FIX.sql` - Fixes permission issues
- `supabase/migrations/*` - Historical function definitions

### Frontend Usage
- `src/hooks/useChatSession.ts` - Uses ai-sql-orchestrator
- `src/hooks/useSupabaseSchemas.ts` - Uses manage-schema-table
- `src/hooks/useBatchProcessor.ts` - Uses insert-clean-data
- `src/components/chat/ChatMessage.tsx` - Uses ai-chart-generator

---

## 🚀 Quick Fix Checklist

If you're getting edge/database function errors:

- [ ] Run `CREATE_REQUIRED_FUNCTIONS.sql` in Supabase SQL Editor
- [ ] Run `FUNCTION_PERMISSIONS_FIX.sql` in Supabase SQL Editor
- [ ] Verify `OPENAI_API_KEY` is set in Edge Function Secrets
- [ ] Check edge function deployment status in Supabase Dashboard
- [ ] Verify user is authenticated (check auth token)
- [ ] Check edge function logs for specific errors
- [ ] Test database functions individually with SQL queries

---

## 💡 Best Practices

1. **Always use database functions for DDL**: Never run CREATE/ALTER directly from frontend
2. **Validate inputs**: Edge functions validate before calling database functions
3. **Handle errors gracefully**: Both edge and DB functions return structured errors
4. **Use SECURITY DEFINER carefully**: Only on trusted functions with input validation
5. **Set search_path**: Prevent schema injection attacks
6. **Grant minimal permissions**: Only grant EXECUTE to authenticated when needed
7. **Log extensively**: Edge functions use console.log, DB functions use RAISE NOTICE
8. **Test database functions**: Use SQL editor to test before deploying edge functions

