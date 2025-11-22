import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Updating execute_safe_query function to support CTEs...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // SQL to update the function
    const updateFunctionSQL = `
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
        IF normalized_query ~ '\\s(DELETE|INSERT|UPDATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE)\\s' 
           OR normalized_query ~ '^(DELETE|INSERT|UPDATE|DROP|ALTER|CREATE TABLE|CREATE INDEX|TRUNCATE|GRANT|REVOKE)\\s'
           OR normalized_query ~ '\\s(DELETE|INSERT|UPDATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE)$' THEN
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
    `;

    // Execute the SQL
    const { error: updateError } = await supabaseClient.rpc('exec_sql', {
      sql: updateFunctionSQL
    });

    if (updateError) {
      console.error('Error updating function:', updateError);
      throw updateError;
    }

    console.log('✅ Successfully updated execute_safe_query function');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'execute_safe_query function updated to support CTEs and complex queries'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in update-safe-query-function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
