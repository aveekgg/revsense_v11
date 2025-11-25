import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryRequest {
  userQuery: string;
  sessionId: string;
  chatHistory: Array<{ role: string; content: string }>;
}

// Canonical non-pivot output row shape used for all analytical queries
// One row per (period, entity, metric)
interface CanonicalRow {
  period: string;        // date string, first day of period (month / quarter / half / year)
  period_grain: 'month' | 'quarter' | 'half_year' | 'year';
  entity_name: string;   // hotel / property / asset name
  metric_name: string;   // semantic key, e.g. total_revenue, fnb_share_of_total
  metric_label: string;  // human friendly label
  metric_type: 'absolute' | 'percentage';
  metric_value: number;  // percentages always 0-100 range
  reporting_currency?: string; // currency code (e.g., 'USD', 'INR') for currency metrics
  [key: string]: any;    // allow extra dimensions if needed
}

interface CleanIntentMetric {
  name: string;
  label: string;
  type: 'absolute' | 'percentage';
}

interface CleanIntentTime {
  grain: 'month' | 'quarter' | 'half_year' | 'year';
  lookback_periods?: number | null;
  start_period?: string | null;
  end_period?: string | null;
}

interface CleanIntent {
  cleanQuery: string;
  time: CleanIntentTime;
  entities: string[];
  metrics: CleanIntentMetric[];
}

function escapeForPrompt(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('AI SQL Orchestrator function invoked (canonical non-pivot output)');
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    const { userQuery, sessionId, chatHistory }: QueryRequest = body;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

    const { data: schemas, error: schemasError } = await supabaseClient
      .from('schemas')
      .select('*');

    if (schemasError) {
      console.error('Error fetching schemas:', schemasError);
      throw schemasError;
    }

    console.log(`Found ${schemas?.length || 0} schemas:`, schemas?.map((s: any) => s.name).join(', '));

    // Fetch table info (same as before)
    const tablesInfo = await Promise.all((schemas || []).map(async (schema: any) => {
      const { data: sanitizedName, error: sanitizeError } = await supabaseClient
        .rpc('sanitize_table_name', { p_name: schema.name });

      if (sanitizeError) {
        console.error(`❌ Could not sanitize table name for schema "${schema.name}":`, sanitizeError);
        return null;
      }

      const tableName = `clean_${sanitizedName}`;
      console.log(`Checking table: ${tableName} for schema: ${schema.name}`);

      try {
        const { data: columns, error: colsError } = await supabaseClient
          .rpc('get_table_columns', { p_table_name: tableName });

        if (colsError) {
          console.error(`❌ Could not fetch columns for ${tableName}:`, colsError);
          return null;
        }

        if (!columns || columns.length === 0) {
          console.warn(`⚠️ No columns found for ${tableName} - table might not exist`);
          return null;
        }

        const { data: samples, error: samplesError } = await supabaseClient
          .from(tableName)
          .select('*')
          .limit(5);

        if (samplesError) {
          console.warn(`⚠️ Could not fetch samples for ${tableName}:`, samplesError);
        }

        return {
          schemaName: schema.name,
          schemaDescription: schema.description,
          tableName,
          columns: (columns || []).map((col: any) => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES'
          })),
          sampleRows: samples || []
        };
      } catch (err) {
        console.warn(`Error processing schema ${schema.name}:`, err);
        return null;
      }
    }));

    const validTables = tablesInfo.filter(t => t !== null);
    console.log(`Valid tables found: ${validTables.length} out of ${tablesInfo.length} schemas`);

    if (validTables.length === 0) {
      const schemaNames = (schemas || []).map((s: any) => s.name).join(', ');
      const errorMsg = `No database tables found for your schemas: ${schemaNames}. Possible causes: 
1. Tables haven't been created yet (go to Add Data page to upload data)
2. RPC functions (sanitize_table_name, get_table_columns) might not have proper permissions
3. Table names don't match expected format (clean_<schema_name>)

Please check the logs for more details.`;
      console.error('❌ No valid tables found. Check the logs above for specific errors.');

      await supabaseClient.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: errorMsg,
      });
      return new Response(JSON.stringify({ error: errorMsg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Business context from storage
    let businessContextMarkdown = 'No business context defined yet.';
    try {
      const { data: fileData, error: storageError } = await supabaseClient.storage
        .from('business-context-docs')
        .download('business-context.md');

      if (!storageError && fileData) {
        businessContextMarkdown = await fileData.text();
      }
    } catch (error) {
      console.log('Business context file not found, using default');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable not configured');
    }

    console.log('========== STAGE 0: CLEAN INTENT EXTRACTION ==========');
    console.log('Input - User Query:', userQuery);
    console.log('Input - Session ID:', sessionId);
    console.log('Input - Chat History Length:', chatHistory.length);

    // ========== Step 0: Clean intent (no pivot, canonical long output) ==========
    const schemaSummary = validTables.map((table: any) => `
Table: ${table.tableName}
Schema: "${table.schemaName}" - ${table.schemaDescription || 'No description'}
Columns: ${table.columns.map((c: any) => c.name).join(', ')}
Sample Rows: ${JSON.stringify(table.sampleRows, null, 2)}
`).join('\n');

    console.log('Input - Schema Summary:', schemaSummary.substring(0, 500) + '...');
    console.log('Input - Business Context Length:', businessContextMarkdown.length, 'characters');

    const cleanIntentPrompt = `You are a query refinement expert for a financial/hospitality data warehouse.

# AVAILABLE DATA
${escapeForPrompt(schemaSummary)}

# BUSINESS CONTEXT
${escapeForPrompt(businessContextMarkdown)}

# CONVERSATION HISTORY
${chatHistory.map(msg => `${msg.role}: ${escapeForPrompt(msg.content)}`).join(' ')}

# CURRENT QUESTION
${escapeForPrompt(userQuery)}

Your task:
1) Produce a clarified cleanQuery in natural language.
2) Extract:
   - time.grain: one of ["month", "quarter", "half_year", "year"]. Minimum grain is month (never day or week).
   - time.lookback_periods: integer number of periods to look back (e.g. 7 months). If user gives explicit start/end, you may set this null.
   - time.start_period / time.end_period: ISO-like period boundaries when user explicitly asks for a fixed range (else null).
3) Resolve entities: array of concrete entity names (e.g. hotel/property names) from the data.
4) Resolve metrics from business context: array of metrics with fields { name, label, type }, where type is "absolute" or "percentage".
   - For percentage metrics, the *value* should represent 0-100 (not 0-1). SQL will handle scaling.

Respond ONLY with JSON:
{
  "cleanQuery": "...",
  "time": { "grain": "month|quarter|half_year|year", "lookback_periods": number|null, "start_period": string|null, "end_period": string|null },
  "entities": ["..."],
  "metrics": [
    { "name": "total_revenue", "label": "Total Revenue", "type": "absolute" },
    { "name": "fnb_share_of_total", "label": "F&B % of Total Revenue", "type": "percentage" }
  ]
}`;

    const preprocessResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.1-2025-11-13',
        messages: [
          { role: 'system', content: 'You are a query refinement expert. Always respond with valid JSON.' },
          { role: 'user', content: cleanIntentPrompt }
        ],
        max_completion_tokens: 800,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    console.log('API Call - Stage 0: Calling OpenAI for intent extraction');
    console.log('API Call - Model:', 'gpt-5.1-2025-11-13');
    console.log('API Call - Max Completion Tokens:', 800);

    const preprocessData = await preprocessResponse.json();
    
    console.log('Output - Stage 0: OpenAI Response received');
    console.log('Output - Has choices:', !!preprocessData.choices);
    console.log('Output - Choice count:', preprocessData.choices?.length || 0);
    
    if (!preprocessData.choices?.[0]?.message?.content) {
      console.error('ERROR - Stage 0: No content in response:', JSON.stringify(preprocessData));
      throw new Error(`Preprocessing failed: ${JSON.stringify(preprocessData)}`);
    }

    let rawContent = preprocessData.choices[0].message.content as string;
    console.log('Output - Stage 0: Raw content length:', rawContent.length);
    console.log('Output - Stage 0: Raw content preview:', rawContent.substring(0, 200));
    
    rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let cleanIntent: CleanIntent;
    try {
      cleanIntent = JSON.parse(rawContent);
      console.log('Output - Stage 0: Successfully parsed clean intent');
      console.log('Output - Stage 0: Clean Query:', cleanIntent.cleanQuery);
      console.log('Output - Stage 0: Time Grain:', cleanIntent.time.grain);
      console.log('Output - Stage 0: Entities:', cleanIntent.entities.join(', '));
      console.log('Output - Stage 0: Metrics:', cleanIntent.metrics.map(m => m.name).join(', '));
    } catch (parseError: any) {
      console.error('ERROR - Stage 0: Failed to parse clean intent:', parseError);
      console.error('ERROR - Stage 0: Raw content:', rawContent);
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`JSON parsing failed: ${parseError.message}`);
      cleanIntent = JSON.parse(jsonMatch[0]);
      console.log('Output - Stage 0: Recovered clean intent from regex match');
    }

    const { cleanQuery, time, entities, metrics } = cleanIntent;

    console.log('========== STAGE 1: QUERY CLASSIFICATION ==========');
    console.log('Input - Stage 1: Clean Query:', cleanQuery);
    console.log('Input - Stage 1: Available Schemas:', schemas?.length || 0);

    // Step 1: Classification (reuse existing logic, but with cleanQuery)
    const classificationPrompt = `You are a SQL query classifier.

Available schemas:
${JSON.stringify(schemas, null, 2)}

Business Context:
${businessContextMarkdown}

Conversation history:
${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Refined query: "${cleanQuery}"

Respond with JSON:
{ "status": "clear" | "needs_clarification", "confidence": 0.0-1.0, "questions": ["..."] }`;

    const classificationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are a query classification expert. Always respond with valid JSON.' },
          { role: 'user', content: classificationPrompt }
        ],
        max_completion_tokens: 400,
        temperature: 0.5,
        response_format: { type: 'json_object' }
      }),
    });

    console.log('API Call - Stage 1: Calling OpenAI for classification');
    console.log('API Call - Model:', 'gpt-4.1-2025-04-14');
    console.log('API Call - Max Completion Tokens:', 400);

    const classificationData = await classificationResponse.json();
    
    console.log('Output - Stage 1: OpenAI Response received');
    console.log('Output - Has choices:', !!classificationData.choices);
    
    if (!classificationData.choices?.[0]?.message?.content) {
      console.error('ERROR - Stage 1: No content in response:', JSON.stringify(classificationData));
      throw new Error(`Classification failed: ${JSON.stringify(classificationData)}`);
    }
    const classification = JSON.parse(classificationData.choices[0].message.content);
    
    console.log('Output - Stage 1: Classification Status:', classification.status);
    console.log('Output - Stage 1: Confidence:', classification.confidence);
    
    if (classification.status === 'needs_clarification') {
      console.log('Output - Stage 1: Needs clarification. Questions:', classification.questions);
      await supabaseClient.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: classification.questions.join('\n'),
      });
      return new Response(JSON.stringify({ needsClarification: true, questions: classification.questions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('========== STAGE 2: SQL GENERATION ==========');
    console.log('Input - Stage 2: Clean Intent:', JSON.stringify(cleanIntent, null, 2));
    console.log('Input - Stage 2: Valid Tables Count:', validTables.length);

    // ========== Step 2: SQL generation into canonical non-pivot schema ==========
    const sqlPrompt = `You are an expert PostgreSQL query generator.

Your job is to generate a single SQL statement that returns data in a fixed canonical LONG format (non-pivot), regardless of how many entities or metrics are requested.

CANONICAL OUTPUT SCHEMA (REQUIRED):
Each row must represent one (period, entity, metric) combination with the following columns and exact names:
- period (date or timestamp)       -- first day of the period (month/quarter/half/year)
- period_grain (text)             -- one of 'month', 'quarter', 'half_year', 'year'
- entity_name (text)              -- hotel/property/asset name
- metric_name (text)              -- semantic key from metrics[].name
- metric_label (text)             -- human label from metrics[].label
- metric_type (text)              -- 'absolute' or 'percentage' from metrics[].type
- metric_value (numeric)          -- numeric value; for percentage metrics this MUST be 0-100 range (not 0-1)
- reporting_currency (text)       -- OPTIONAL: currency code (e.g., 'USD', 'INR') if the source table has a reporting_currency column; include this for ALL currency-related metrics

AVAILABLE TABLES & COLUMNS:
${validTables.map((table: any) => `
Table Name: ${table.tableName} (use this EXACT name in FROM clause)
Description: "${table.schemaName}" - ${table.schemaDescription || 'No description'}
Columns:
${table.columns.map((col: any) => `  - ${col.name} (${col.type}${col.nullable ? ', nullable' : ''})`).join('\n')}
Sample Data (first 5 rows):
${JSON.stringify(table.sampleRows, null, 2)}
`).join('\n')}

BUSINESS CONTEXT:
${businessContextMarkdown}

CLEAN INTENT:
${JSON.stringify(cleanIntent, null, 2)}

RULES (STRICTLY FOLLOW):
1. Do NOT pivot into separate columns per entity or metric. Always return multiple rows with the canonical columns listed above.
2. The SQL MUST select columns with these exact aliases: period, period_grain, entity_name, metric_name, metric_label, metric_type, metric_value, and optionally reporting_currency.
3. If the source table has a reporting_currency column, include it in the SELECT for ALL metrics (currency and non-currency). If the table doesn't have this column, omit it entirely.
4. Time grain:
   - time.grain is one of month, quarter, half_year, year.
   - Minimum grain is month (never day, never week).
   - For month: period = date_trunc('month', <date_col>)::date.
   - For quarter: period = date_trunc('quarter', <date_col>)::date.
   - For half_year: derive first day of H1/H2 (you may use CASE around month extracted from date_trunc('month', ...)).
   - For year: period = date_trunc('year', <date_col>)::date.
5. Period filtering:
   - If time.lookback_periods is provided, filter the last N periods of the given grain relative to current_date.
   - If start_period/end_period are provided, filter between them.
6. Grouping:
   - Aggregate at the chosen time grain and by entity (e.g., GROUP BY period, entity_name).
7. Metric computation:
   - For each metric in metrics[]:
     - If type = 'absolute', metric_value should be the aggregated numeric value.
     - If type = 'percentage', metric_value MUST be computed as (numerator / denominator) * 100 so the final number is in 0-100 range.
   - You may use a base CTE to compute reusable aggregates (total_revenue, fnb_revenue, etc.), then UNION ALL separate SELECTs per metric into the canonical schema.
8. Sorting:
   - ORDER BY period ASC, entity_name ASC, metric_name ASC.
9. Table usage:
   - Use only the exact table names listed above (e.g., FROM clean_hotel_revenue_data).
   - Do NOT use schema prefixes (no dots in table names).
10. Do NOT include a trailing semicolon in the SQL string.

Return JSON only:
{
  "sql": "SELECT ...",
  "explanation": "short explanation of how your SQL implements the canonical schema and respects grain, entities, metrics, and percentages"
}`;

    const sqlResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.1-2025-11-13',
        messages: [
          { role: 'system', content: 'You are an expert SQL generator. Always respond with valid JSON.' },
          { role: 'user', content: sqlPrompt }
        ],
        max_completion_tokens: 2000,
        temperature: 0.25,
        response_format: { type: 'json_object' }
      }),
    });

    console.log('API Call - Stage 2: Calling OpenAI for SQL generation');
    console.log('API Call - Model:', 'gpt-5.1-2025-11-13');
    console.log('API Call - Max Completion Tokens:', 2000);

    const sqlData = await sqlResponse.json();
    
    console.log('Output - Stage 2: OpenAI Response received');
    console.log('Output - Has choices:', !!sqlData.choices);
    
    if (!sqlData.choices?.[0]?.message?.content) {
      console.error('ERROR - Stage 2: No content in response:', JSON.stringify(sqlData));
      throw new Error(`SQL generation failed: ${JSON.stringify(sqlData)}`);
    }
    const sqlResult = JSON.parse(sqlData.choices[0].message.content);
    const sanitizedSql = (sqlResult.sql as string).trim().replace(/;$/, '');
    
    console.log('Output - Stage 2: Generated SQL length:', sanitizedSql.length);
    console.log('Output - Stage 2: SQL:', sanitizedSql);
    console.log('Output - Stage 2: Explanation:', sqlResult.explanation);

    console.log('========== STAGE 3: SQL EXECUTION ==========');
    console.log('Input - Stage 3: Executing SQL query');
    
    // Step 3: Execute SQL (results will already be canonical rows)
    const { data, error: queryError } = await supabaseClient
      .rpc('execute_safe_query', { p_query_text: sanitizedSql });

    if (queryError) {
      console.error('ERROR - Stage 3: SQL execution failed:', queryError);
      throw new Error(`SQL execution failed: ${queryError.message}`);
    }

    let queryResult: any[] = Array.isArray(data) ? data : (data ? [data] : []);
    
    console.log('Output - Stage 3: Query executed successfully');
    console.log('Output - Stage 3: Result row count:', queryResult.length);
    console.log('Output - Stage 3: First 3 rows:', JSON.stringify(queryResult.slice(0, 3), null, 2));

    // Ensure numeric percentages are in 0-100 range (defensive; SQL should already do this)
    queryResult = queryResult.map((row: any) => {
      const r: any = { ...row };
      if (r.metric_type === 'percentage' && typeof r.metric_value === 'number' && r.metric_value <= 1) {
        r.metric_value = r.metric_value * 100;
      }
      return r;
    }) as CanonicalRow[];

    console.log('========== STAGE 4: DATA SUMMARY GENERATION ==========');
    console.log('Input - Stage 4: Rows to summarize:', Math.min(queryResult.length, 50));

    // Step 4: Generate Data Summary (explanatory answer)
    const safeQueryResult = Array.isArray(queryResult) ? queryResult : [];
    const summaryPrompt = `Analyze these query results and provide a brief, natural language summary for a business user.

Clean query: ${cleanQuery}
SQL: ${sanitizedSql}
Results (first 50 rows in canonical long format): ${JSON.stringify(safeQueryResult.slice(0, 50))}

Use business language and mention time range, entities, and key metrics. Respond as JSON:
{
  "short_answer": "1-2 sentence high level answer",
  "detailed_explanation": "2-4 sentences describing trends, comparisons, and any notable patterns"
}`;

    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { role: 'system', content: 'You are a data summarization expert. Always respond with valid JSON.' },
          { role: 'user', content: summaryPrompt }
        ],
        max_completion_tokens: 400,
        temperature: 0.6,
        response_format: { type: 'json_object' }
      }),
    });

    console.log('API Call - Stage 4: Calling OpenAI for summary generation');
    console.log('API Call - Model:', 'gpt-5-nano-2025-08-07');
    console.log('API Call - Max Completion Tokens:', 400);

    const summaryData = await summaryResponse.json();
    
    console.log('Output - Stage 4: OpenAI Response received');
    console.log('Output - Has choices:', !!summaryData.choices);
    
    if (!summaryData.choices?.[0]?.message?.content) {
      console.error('ERROR - Stage 4: No content in response:', JSON.stringify(summaryData));
      throw new Error(`Summary generation failed: ${JSON.stringify(summaryData)}`);
    }
    const summaryPayload = JSON.parse(summaryData.choices[0].message.content);
    const dataSummary: string = summaryPayload.short_answer || summaryPayload.detailed_explanation || '';
    
    console.log('Output - Stage 4: Summary generated');
    console.log('Output - Stage 4: Summary length:', dataSummary.length);
    console.log('Output - Stage 4: Summary:', dataSummary);

    console.log('========== PERSISTING CHAT MESSAGE ==========');
    // Persist chat message; keep metadata shape similar so frontend doesn't break
    await supabaseClient.from('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: dataSummary,
      sql_query: sanitizedSql,
      query_result: queryResult,
      data_summary: dataSummary,
      metadata: {
        originalQuery: userQuery,
        cleanedQuery: cleanQuery,
        intent: cleanIntent
      }
    });

    console.log('========== FINAL RESPONSE ==========');
    console.log('Output - Final: Returning successful response');
    console.log('Output - Final: Results count:', queryResult.length);
    console.log('Output - Final: SQL length:', sanitizedSql.length);

    // Final response: preserve top-level structure the frontend expects
    return new Response(
      JSON.stringify({
        needsClarification: false,
        sql: sanitizedSql,
        explanation: sqlResult.explanation,
        dataSummary,
        results: queryResult,
        // keep outputFormat field present but null so frontend code accessing it won't crash
        outputFormat: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-sql-orchestrator (canonical):', error);
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
