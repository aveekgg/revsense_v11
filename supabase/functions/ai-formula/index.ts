import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIFormulaRequest {
  prompt: string;
  cellData: any[];
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'enum';
  enumOptions?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, cellData, fieldType, enumOptions }: AIFormulaRequest = await req.json();

    console.log('AI Formula Request:', { prompt, cellData, fieldType, enumOptions });

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Build system prompt based on field type
    let systemPrompt = `You are a data transformation assistant. Transform the provided cell data according to the user's instruction.

IMPORTANT OUTPUT RULES:
- Return value must match type: ${fieldType}`;

    if (fieldType === 'enum' && enumOptions?.length) {
      systemPrompt += `\n- CRITICAL: Return ONLY one of these exact values: ${enumOptions.join(', ')}`;
    } else if (fieldType === 'number' || fieldType === 'currency') {
      systemPrompt += `\n- Return only the numeric value (no text, no currency symbols)`;
    } else if (fieldType === 'date') {
      systemPrompt += `\n- Return date in ISO 8601 format (YYYY-MM-DD)`;
    } else if (fieldType === 'boolean') {
      systemPrompt += `\n- Return only true or false`;
    }

    systemPrompt += `\n- If transformation is impossible, return null`;

    // Build user message
    const userMessage = `${prompt}

Cell data: ${JSON.stringify(cellData)}`;

    // Call OpenAI with function calling for structured output
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_value',
            description: 'Return the transformed value',
            parameters: {
              type: 'object',
              properties: {
                value: {
                  type: getSchemaType(fieldType),
                  description: 'The transformed value'
                },
                confidence: {
                  type: 'number',
                  description: 'Confidence score between 0 and 1'
                }
              },
              required: ['value', 'confidence']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'return_value' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data, null, 2));

    const functionCall = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
    if (!functionCall) {
      throw new Error('No function call in OpenAI response');
    }

    const result = JSON.parse(functionCall.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-formula:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        value: null,
        confidence: 0
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getSchemaType(fieldType: string): string {
  switch (fieldType) {
    case 'number':
    case 'currency':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}
