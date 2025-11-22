-- Drop and recreate get_table_columns function to fix parameter ambiguity
DROP FUNCTION IF EXISTS public.get_table_columns(TEXT);

CREATE FUNCTION public.get_table_columns(p_table_name TEXT)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND information_schema.tables.table_name = p_table_name
  ) THEN
    RAISE EXCEPTION 'Table does not exist: %', p_table_name;
  END IF;

  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_name = p_table_name
    AND c.table_schema = 'public'
    AND c.column_name NOT IN ('id', 'user_id', 'source_workbook', 'source_mapping_id', 'extracted_at');
END;
$$;