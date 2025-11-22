-- ============================================
-- RECREATE ALL CLEAN TABLES FOR EXISTING SCHEMAS
-- ============================================
-- This script will create clean_* tables for all schemas
-- that don't have their corresponding tables yet
-- 
-- Run this SQL in your Supabase SQL Editor
-- ============================================

DO $$
DECLARE
  schema_rec RECORD;
  table_name TEXT;
  field_rec RECORD;
  column_def TEXT;
  columns_list TEXT := '';
BEGIN
  -- Loop through all schemas
  FOR schema_rec IN 
    SELECT id, name, fields 
    FROM public.schemas
  LOOP
    -- Construct table name
    table_name := 'clean_' || lower(regexp_replace(schema_rec.name, '\s+', '_', 'g'));
    
    -- Check if table already exists
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = table_name
    ) THEN
      RAISE NOTICE 'Creating table: %', table_name;
      
      -- Build columns list from schema fields
      columns_list := '';
      FOR field_rec IN 
        SELECT 
          value->>'name' as field_name,
          value->>'type' as field_type
        FROM jsonb_array_elements(schema_rec.fields::jsonb)
      LOOP
        -- Map field types to PostgreSQL types
        column_def := lower(regexp_replace(field_rec.field_name, '\s+', '_', 'g')) || ' ';
        
        CASE field_rec.field_type
          WHEN 'number' THEN column_def := column_def || 'NUMERIC';
          WHEN 'date' THEN column_def := column_def || 'DATE';
          WHEN 'boolean' THEN column_def := column_def || 'BOOLEAN';
          ELSE column_def := column_def || 'TEXT';
        END CASE;
        
        IF columns_list != '' THEN
          columns_list := columns_list || ', ';
        END IF;
        columns_list := columns_list || column_def;
      END LOOP;
      
      -- Create the table
      EXECUTE format('
        CREATE TABLE public.%I (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          schema_id UUID NOT NULL,
          %s,
          source_workbook TEXT NOT NULL,
          source_mapping_id TEXT,
          extracted_at TIMESTAMPTZ DEFAULT now(),
          created_at TIMESTAMPTZ DEFAULT now()
        )', table_name, columns_list);
      
      -- Enable RLS
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      
      -- Create RLS policies (global read, user-specific write)
      EXECUTE format('
        CREATE POLICY %I ON public.%I
        FOR SELECT
        TO authenticated
        USING (true)
      ', table_name || '_select_policy', table_name);
      
      EXECUTE format('
        CREATE POLICY %I ON public.%I
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id)
      ', table_name || '_insert_policy', table_name);
      
      EXECUTE format('
        CREATE POLICY %I ON public.%I
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
      ', table_name || '_update_policy', table_name);
      
      EXECUTE format('
        CREATE POLICY %I ON public.%I
        FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id)
      ', table_name || '_delete_policy', table_name);
      
      -- Create index on schema_id
      EXECUTE format('
        CREATE INDEX %I ON public.%I(schema_id)
      ', 'idx_' || table_name || '_schema_id', table_name);
      
      RAISE NOTICE 'Successfully created table: % with RLS policies', table_name;
    ELSE
      RAISE NOTICE 'Table already exists: %', table_name;
    END IF;
  END LOOP;
END $$;
