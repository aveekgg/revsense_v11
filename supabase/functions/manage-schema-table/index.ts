import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map SchemaField types to PostgreSQL types
const TYPE_MAPPING: Record<string, string> = {
  'text': 'TEXT',
  'integer': 'INTEGER',
  'number': 'DOUBLE PRECISION',
  'currency': 'NUMERIC(12,2)',
  'date': 'DATE',
  'datetime': 'TIMESTAMPTZ',
  'boolean': 'BOOLEAN',
  'email': 'TEXT',
  'phone': 'TEXT',
  'url': 'TEXT',
  'enum': 'TEXT',
};

interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { operation, schemaId, schemaName, fields, tableName } = await req.json();

    console.log(`Managing schema table - Operation: ${operation}, Schema: ${schemaName || schemaId}`);

    // Sanitize table name
    const { data: sanitizedName, error: sanitizeError } = await supabaseClient
      .rpc('sanitize_table_name', { name: tableName || schemaName });

    if (sanitizeError) {
      console.error('Error sanitizing table name:', sanitizeError);
      throw new Error(`Failed to sanitize table name: ${sanitizeError.message}`);
    }

    const finalTableName = `clean_${sanitizedName}`;

    if (operation === 'create') {
      // Build CREATE TABLE statement
      const columnDefs = (fields as SchemaField[]).map(field => {
        const pgType = TYPE_MAPPING[field.type] || 'TEXT';
        const nullable = field.required ? 'NOT NULL' : 'NULL';
        const sanitizedColName = field.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        return `${sanitizedColName} ${pgType} ${nullable}`;
      }).join(',\n  ');

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.${finalTableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          source_workbook TEXT,
          source_mapping_id UUID,
          extracted_at TIMESTAMPTZ DEFAULT NOW(),
          ${columnDefs}
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_${sanitizedName}_user_id ON public.${finalTableName}(user_id);
        CREATE INDEX IF NOT EXISTS idx_${sanitizedName}_extracted_at ON public.${finalTableName}(extracted_at);

        -- Enable RLS
        ALTER TABLE public.${finalTableName} ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies (Global read access)
        DROP POLICY IF EXISTS "All authenticated users can view data" ON public.${finalTableName};
        CREATE POLICY "All authenticated users can view data" 
          ON public.${finalTableName} FOR SELECT 
          TO authenticated
          USING (true);

        DROP POLICY IF EXISTS "Users can insert their own data" ON public.${finalTableName};
        CREATE POLICY "Users can insert their own data" 
          ON public.${finalTableName} FOR INSERT 
          TO authenticated
          WITH CHECK (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can update their own data" ON public.${finalTableName};
        CREATE POLICY "Users can update their own data" 
          ON public.${finalTableName} FOR UPDATE 
          TO authenticated
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can delete their own data" ON public.${finalTableName};
        CREATE POLICY "Users can delete their own data" 
          ON public.${finalTableName} FOR DELETE 
          TO authenticated
          USING (auth.uid() = user_id);
      `;

      const { data, error } = await supabaseClient.rpc('execute_ddl', { 
        ddl_statement: createTableSQL 
      });

      if (error) {
        console.error('Error creating table:', error);
        throw new Error(`Failed to create table: ${error.message}`);
      }

      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        console.error('Error creating table:', data.error);
        throw new Error(`Failed to create table: ${data.error || 'Unknown error'}`);
      }

      console.log(`Successfully created table: ${finalTableName}`);

      return new Response(JSON.stringify({ 
        success: true, 
        tableName: finalTableName,
        message: `Table ${finalTableName} created successfully`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (operation === 'update') {
      // Get current table columns
      const { data: currentColumns, error: columnsError } = await supabaseClient
        .rpc('get_table_columns', { p_table_name: finalTableName });

      if (columnsError) {
        console.error('Error fetching current columns:', columnsError);
        throw new Error(`Failed to fetch table columns: ${columnsError.message}`);
      }

      const currentColNames = new Set(currentColumns.map((c: any) => c.column_name));
      const newFields = (fields as SchemaField[]).map(f => ({
        ...f,
        sanitizedName: f.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      }));
      const newColNames = new Set(newFields.map(f => f.sanitizedName));

      // Find columns to add
      const toAdd = newFields.filter(f => !currentColNames.has(f.sanitizedName));
      
      // Find columns to drop
      const toDrop = Array.from(currentColNames).filter((col: any) => !newColNames.has(col as string));

      let alterStatements = [];

      // Add new columns
      for (const field of toAdd) {
        const pgType = TYPE_MAPPING[field.type] || 'TEXT';
        // For enum fields, set default to NULL even if required, to avoid constraint issues
        const nullable = (field.required && field.type !== 'enum') ? 'NOT NULL DEFAULT \'\'' : 'NULL';
        alterStatements.push(
          `ALTER TABLE public.${finalTableName} ADD COLUMN IF NOT EXISTS ${field.sanitizedName} ${pgType} ${nullable};`
        );
      }

      // Drop removed columns
      for (const colName of toDrop) {
        alterStatements.push(
          `ALTER TABLE public.${finalTableName} DROP COLUMN IF EXISTS ${colName};`
        );
      }

      if (alterStatements.length > 0) {
        const alterSQL = alterStatements.join('\n');
        const { data, error } = await supabaseClient.rpc('execute_ddl', { 
          ddl_statement: alterSQL 
        });

        if (error) {
          console.error('Error updating table:', error);
          throw new Error(`Failed to update table: ${error.message}`);
        }

        if (data && typeof data === 'object' && 'success' in data && !data.success) {
          console.error('Error updating table:', data.error);
          throw new Error(`Failed to update table: ${data.error || 'Unknown error'}`);
        }

        console.log(`Successfully updated table: ${finalTableName}`);
      } else {
        console.log(`No changes needed for table: ${finalTableName}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        tableName: finalTableName,
        message: `Table ${finalTableName} updated successfully`,
        columnsAdded: toAdd.length,
        columnsRemoved: toDrop.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (operation === 'delete') {
      const dropTableSQL = `DROP TABLE IF EXISTS public.${finalTableName} CASCADE;`;

      const { data, error } = await supabaseClient.rpc('execute_ddl', { 
        ddl_statement: dropTableSQL 
      });

      if (error) {
        console.error('Error dropping table:', error);
        throw new Error(`Failed to drop table: ${error.message}`);
      }

      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        console.error('Error dropping table:', data.error);
        throw new Error(`Failed to drop table: ${data.error || 'Unknown error'}`);
      }

      console.log(`Successfully dropped table: ${finalTableName}`);

      return new Response(JSON.stringify({ 
        success: true, 
        tableName: finalTableName,
        message: `Table ${finalTableName} deleted successfully`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in manage-schema-table:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
