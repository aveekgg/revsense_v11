import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { tableName, data, sourceWorkbook, sourceMappingId } = await req.json();

    console.log(`Inserting data into table: ${tableName}`);

    // Validate table name format
    if (!tableName || !tableName.startsWith('clean_')) {
      return new Response(JSON.stringify({ error: 'Invalid table name format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify table exists
    const { data: tableExists, error: checkError } = await supabaseClient
      .from(tableName)
      .select('id')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      return new Response(JSON.stringify({ error: `Table ${tableName} does not exist` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare insert data
    const insertData: any = {
      user_id: user.id,
      source_workbook: sourceWorkbook,
      source_mapping_id: sourceMappingId,
      ...data
    };

    // Insert the data
    const { data: insertedRow, error: insertError } = await supabaseClient
      .from(tableName)
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting data:', insertError);
      throw new Error(`Failed to insert data: ${insertError.message}`);
    }

    console.log(`Successfully inserted data into ${tableName}`);

    return new Response(JSON.stringify({ 
      success: true,
      data: insertedRow
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in insert-clean-data:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
