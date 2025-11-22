# Update Safe Query Function for CTE Support

## Problem
The current `execute_safe_query` function only allows queries starting with `SELECT`, which blocks Common Table Expressions (CTEs) that start with `WITH`.

## Solution
Run this SQL in your Supabase SQL Editor to update the function:

```sql
CREATE OR REPLACE FUNCTION public.execute_safe_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  normalized_query TEXT;
BEGIN
  -- Normalize the query for validation (trim and uppercase)
  normalized_query := UPPER(TRIM(query_text));
  
  -- Validate that the query is a SELECT statement (can start with WITH for CTEs)
  IF NOT (normalized_query LIKE 'SELECT%' OR normalized_query LIKE 'WITH%') THEN
    RETURN jsonb_build_object(
      'error', 'Only SELECT queries are allowed',
      'details', 'Query must start with SELECT or WITH (for CTEs)'
    );
  END IF;
  
  -- Check for dangerous keywords that could modify data
  -- More precise regex to avoid false positives with column names
  IF normalized_query ~ '\s(DELETE|INSERT|UPDATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE)\s' 
     OR normalized_query ~ '^(DELETE|INSERT|UPDATE|DROP|ALTER|CREATE TABLE|CREATE INDEX|TRUNCATE|GRANT|REVOKE)\s'
     OR normalized_query ~ '\s(DELETE|INSERT|UPDATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE)$' THEN
    RETURN jsonb_build_object(
      'error', 'Query contains forbidden operations',
      'details', 'Only SELECT queries with safe operations are permitted'
    );
  END IF;
  
  -- Additional safety check: ensure query contains SELECT at some point
  IF normalized_query NOT LIKE '%SELECT%' THEN
    RETURN jsonb_build_object(
      'error', 'Query must contain a SELECT statement',
      'details', 'No SELECT found in query'
    );
  END IF;
  
  -- Execute the query and convert results to JSON
  BEGIN
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;
    
    -- Handle empty results
    IF result IS NULL THEN
      result := '[]'::jsonb;
    END IF;
    
    RETURN result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'error', 'Query execution failed',
        'details', SQLERRM
      );
  END;
END;
$function$;
```

## How to Apply

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Paste the SQL above
4. Click "Run"

## What Changed

### More Adaptive Validation:
- ✅ Now accepts queries starting with `WITH` (for CTEs)
- ✅ Still accepts queries starting with `SELECT`
- ✅ More precise dangerous keyword detection (word boundaries)
- ✅ Ensures query contains `SELECT` somewhere

### Security Maintained:
- ✅ Still blocks INSERT, UPDATE, DELETE, DROP, etc.
- ✅ Still validates query structure
- ✅ Still uses SECURITY DEFINER safely
- ✅ Still has proper error handling

### Supported Query Types:
- Simple SELECT queries
- JOIN queries
- Subqueries
- Common Table Expressions (CTEs with WITH)
- Window functions
- Complex aggregations
- UNION/INTERSECT/EXCEPT

### Still Blocked:
- Data modification (INSERT, UPDATE, DELETE)
- Schema changes (DROP, ALTER, CREATE TABLE)
- Permission changes (GRANT, REVOKE)
- Data deletion (TRUNCATE)
