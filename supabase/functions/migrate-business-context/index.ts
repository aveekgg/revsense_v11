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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Fetching business context records for user:', user.id);

    // Fetch all business context records for the user
    const { data: contexts, error: fetchError } = await supabaseClient
      .from('business_context')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    if (!contexts || contexts.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No business context records found to migrate',
          migrated: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${contexts.length} business context records to migrate`);

    // Format contexts as markdown
    const markdown = `# Business Context

This document was automatically migrated from your existing business context records.
Feel free to edit and organize this content as needed.

---

${contexts.map((ctx, index) => `
## ${index + 1}. ${ctx.name}

**Type**: ${ctx.context_type}

**Definition**:
${ctx.definition}

${ctx.examples && ctx.examples.length > 0 ? `
**Examples**:
${Array.isArray(ctx.examples) ? ctx.examples.map((ex: string) => `- ${ex}`).join('\n') : ctx.examples}
` : ''}

---
`).join('\n')}

## 💡 Next Steps

1. Review and organize the content above
2. Add more detail and examples as needed
3. Update the structure to match your workflow
4. Keep this document current as your business evolves
`;

    // Upload to storage
    const blob = new Blob([markdown], { type: 'text/markdown' });
    
    const { error: uploadError } = await supabaseClient.storage
      .from('business-context-docs')
      .upload('business-context.md', blob, {
        contentType: 'text/markdown',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    console.log('Successfully migrated business context to storage');

    return new Response(
      JSON.stringify({ 
        message: `Successfully migrated ${contexts.length} business context records to markdown file`,
        migrated: true,
        recordCount: contexts.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error migrating business context:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
