-- Fix search_path for sanitize_table_name function
CREATE OR REPLACE FUNCTION public.sanitize_table_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Convert to lowercase, replace spaces with underscores, remove special chars
  RETURN regexp_replace(
    regexp_replace(lower(trim(name)), '[^a-z0-9_]', '_', 'g'),
    '_+', '_', 'g'
  );
END;
$$;