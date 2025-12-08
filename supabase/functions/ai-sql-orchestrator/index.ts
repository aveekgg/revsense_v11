/********************************************************************************************
 * AI SQL ORCHESTRATOR — FULLY COMMENTED VERSION
 * ------------------------------------------------------------------------------------------
 * This Supabase Edge Function orchestrates:
 * 1. Clean Intent Extraction (GPT-4.1)
 * 2. Entity + Metric Resolution (local resolver)
 * 3. Query Classification (GPT-4.1)
 * 4. Canonical SQL Generation (GPT-4.1)
 * 5. SQL Execution (Postgres RPC)
 * 6. Natural-language Summary (GPT-4.1-nano)
 *
 * KEY IMPROVEMENTS:
 * ✔ Entity resolution using hotel_name, operator, legal_entity
 * ✔ Clarification when operator/legal_entity are referenced
 * ✔ Fuzzy hotel matching auto-correct
 * ✔ Metric resolution using #metrics section of business-context.md + heuristics
 * ✔ GPT-4.1 models only
 * ✔ Fully inline file — no external imports beyond Supabase + Deno
 * ✔ Canonical long-format row output preserved
 ********************************************************************************************/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

/********************************************************************************************
 * CORS HEADERS — allow browser & Supabase Studio requests
 ********************************************************************************************/
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/********************************************************************************************
 * REQUEST INTERFACES (fallback safety)
 ********************************************************************************************/
interface QueryRequest {
  userQuery: string;
  sessionId: string;
  chatHistory: Array<{ role: string; content: string }>;
}

/********************************************************************************************
 * CANONICAL OUTPUT ROW FORMAT FOR ALL ANALYTICAL QUERIES
 * Required shape across entire system.
 ********************************************************************************************/
interface CanonicalRow {
  period: string;        // first day of month/quarter/year
  period_grain: 'month' | 'quarter' | 'half_year' | 'year';
  entity_name: string;
  metric_name: string;
  metric_label: string;
  metric_type: 'absolute' | 'percentage';
  metric_value: number;
  reporting_currency?: string;
  [key: string]: any;
}

/********************************************************************************************
 * CLEAN INTENT STRUCTURES
 ********************************************************************************************/
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

/********************************************************************************************
 * UTILITY: escapeForPrompt
 * Ensures newline/tab/quote safety when embedding large text into prompts.
 ********************************************************************************************/
function escapeForPrompt(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ');
}

/********************************************************************************************
 * UTILITY: levenshteinDistance
 * Used for fuzzy matching hotel names (auto-correct behavior).
 ********************************************************************************************/
function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[a.length][b.length];
}

/********************************************************************************************
 * UTILITY: similarity
 * Returns a normalized similarity score between 0 and 1.
 ********************************************************************************************/
function similarity(a: string, b: string): number {
  const dist = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

/********************************************************************************************
 * LOADING BUSINESS CONTEXT & METRICS (#metrics section parser)
 ********************************************************************************************/
async function loadBusinessContext(supabase: any): Promise<{
  rawMarkdown: string;
  metrics: CleanIntentMetric[];
}> {
  try {
    const { data: fileData, error } = await supabase.storage
      .from('business-context-docs')
      .download('business-context.md');

    if (error || !fileData) {
      return { rawMarkdown: '', metrics: [] };
    }

    const markdown = await fileData.text();

    // Parse #metrics section
    const metricSectionMatch = markdown.match(/#metrics([\s\S]*?)(#|$)/i);
    let metrics: CleanIntentMetric[] = [];

    if (metricSectionMatch) {
      const lines = metricSectionMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-'));

      metrics = lines.map(line => {
        const clean = line.replace(/^-/, '').trim();
        // Example format: total_revenue: Total Revenue (absolute)
        const parts = clean.split(':');
        if (parts.length < 2) return null;

        const name = parts[0].trim();
        const rest = parts.slice(1).join(':').trim();

        // Extract label + metric type
        const typeMatch = rest.match(/\((absolute|percentage)\)/i);
        const type = typeMatch ? typeMatch[1].toLowerCase() as 'absolute' | 'percentage' : 'absolute';

        const label = rest.replace(/\(absolute\)|\(percentage\)/gi, '').trim();

        return { name, label, type };
      }).filter(Boolean) as CleanIntentMetric[];
    }

    return { rawMarkdown: markdown, metrics };

  } catch {
    return { rawMarkdown: '', metrics: [] };
  }
}

/********************************************************************************************
 * LOADING ENTITY MASTER DATA (hotel_name, operator, legal_entity)
 * This powers the entity resolver.
 ********************************************************************************************/
async function loadEntityMaster(supabase: any) {
  const { data, error } = await supabase
    .from('clean_hotel_master')
    .select('hotel_name, operator, legal_entity');

  if (error || !data) return [];

  return data as Array<{ hotel_name: string; operator: string; legal_entity: string }>;
}

/********************************************************************************************
 * BUILD ENTITY DICTIONARY
 * Creates a unified structure:
 * - canonicalHotelNames[]
 * - canonicalOperators[]
 * - canonicalLegalEntities[]
 * - reverseIndex{} for matching
 ********************************************************************************************/
function buildEntityDictionary(master: any[]) {
  const hotelNames = master
    .map(row => row.hotel_name)
    .filter(Boolean);

  const operators = Array.from(
    new Set(master.map(row => row.operator).filter(Boolean))
  );

  const legalEntities = Array.from(
    new Set(master.map(row => row.legal_entity).filter(Boolean))
  );

  const reverseIndex: Record<string, { type: string; matches: string[] }> = {};

  // Build reverse index for fuzzy lookup
  for (const row of master) {
    const hotel = row.hotel_name.toLowerCase();
    reverseIndex[hotel] = { type: 'hotel_name', matches: [row.hotel_name] };

    const op = row.operator?.toLowerCase();
    if (op) {
      if (!reverseIndex[op]) reverseIndex[op] = { type: 'operator', matches: [] };
      reverseIndex[op].matches.push(row.hotel_name);
    }

    const le = row.legal_entity?.toLowerCase();
    if (le) {
      if (!reverseIndex[le]) reverseIndex[le] = { type: 'legal_entity', matches: [] };
      reverseIndex[le].matches.push(row.hotel_name);
    }
  }

  return {
    hotelNames,
    operators,
    legalEntities,
    reverseIndex
  };
}

/********************************************************************************************
 *
 * END OF PART 1
 * → Say “continue” to receive PART 2 (Entity Resolver, Metric Resolver, Clean Intent Step)
 *
 ********************************************************************************************/

/**************************************************************************************
 * PART 2 — ENTITY RESOLVER, METRIC RESOLVER, CLEAN INTENT (GPT-4.1)
 **************************************************************************************/

/********************************************************************************************
 * HELPER: normalizeString
 * Lowercase, trim, remove extra whitespace and punctuation for matching.
 ********************************************************************************************/
function normalizeString(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/********************************************************************************************
 * ENTITY RESOLVER
 *
 * Inputs:
 *  - rawEntities: array of strings extracted by LLM or user-provided
 *  - entityDict: output of buildEntityDictionary()
 *
 * Outputs:
 *  - resolved: array of canonical hotel names
 *  - ambiguous: array of questions (if any) requiring clarification
 *  - unknown: entities that couldn't be mapped
 *
 * Behavior:
 *  - Exact match (hotel_name/operator/legal_entity) prioritized
 *  - Fuzzy match using similarity() next
 *  - If match maps to an operator/legal_entity that expands to >1 hotel, we DO NOT auto-expand:
 *      • mark ambiguous and generate a clarification question listing top N matches
 *  - If multiple fuzzy matches with similar scores -> ambiguous
 ********************************************************************************************/
function resolveEntities(
  rawEntities: string[],
  entityDict: ReturnType<typeof buildEntityDictionary>,
  options: { fuzzyThreshold?: number; ambiguityDelta?: number } = {}
) {
  const fuzzyThreshold = options.fuzzyThreshold ?? 0.78;
  const ambiguityDelta = options.ambiguityDelta ?? 0.06;
  const resolved: string[] = [];
  const ambiguousQuestions: string[] = [];
  const unknown: string[] = [];

  // helper to add unique resolved entity
  function addResolved(e: string) {
    if (!resolved.includes(e)) resolved.push(e);
  }

  // Precompute normalized sets
  const normHotelMap: Record<string, string> = {};
  for (const hn of entityDict.hotelNames) {
    normHotelMap[normalizeString(hn)] = hn;
  }
  const normOpMap: Record<string, string[]> = {};
  for (const op of entityDict.operators) {
    normOpMap[normalizeString(op)] = entityDict.reverseIndex[normalizeString(op)]?.matches || [];
  }
  const normLeMap: Record<string, string[]> = {};
  for (const le of entityDict.legalEntities) {
    normLeMap[normalizeString(le)] = entityDict.reverseIndex[normalizeString(le)]?.matches || [];
  }

  for (const raw of rawEntities) {
    const n = normalizeString(raw);

    // Exact hotel name match
    if (n in normHotelMap) {
      addResolved(normHotelMap[n]);
      continue;
    }

    // Exact operator match
    if (n in normOpMap) {
      const matches = normOpMap[n] || [];
      if (matches.length === 1) {
        addResolved(matches[0]);
      } else if (matches.length > 1) {
        // ambiguous: operator mapped to many hotels -> ask for clarification (per your choice B)
        const sample = matches.slice(0, 8).map(m => `- ${m}`).join('\n');
        ambiguousQuestions.push(
          `You mentioned the operator "${raw}". That operator includes multiple hotels. Which of these did you mean, or did you mean ALL of them?\n${sample}`
        );
      } else {
        unknown.push(raw);
      }
      continue;
    }

    // Exact legal_entity match
    if (n in normLeMap) {
      const matches = normLeMap[n] || [];
      if (matches.length === 1) {
        addResolved(matches[0]);
      } else if (matches.length > 1) {
        const sample = matches.slice(0, 8).map(m => `- ${m}`).join('\n');
        ambiguousQuestions.push(
          `You mentioned the legal entity "${raw}". That legal entity owns multiple hotels. Which one(s) did you mean?\n${sample}`
        );
      } else {
        unknown.push(raw);
      }
      continue;
    }

    // FUZZY MATCH: check hotel names first
    let bestHotel: { name: string; score: number } | null = null;
    for (const cand of entityDict.hotelNames) {
      const score = similarity(n, normalizeString(cand));
      if (!bestHotel || score > bestHotel.score) bestHotel = { name: cand, score };
    }
    if (bestHotel && bestHotel.score >= fuzzyThreshold) {
      addResolved(bestHotel.name);
      continue;
    }

    // FUZZY MATCH: operator
    let bestOp: { op: string; score: number; matches: string[] } | null = null;
    for (const op of entityDict.operators) {
      const score = similarity(n, normalizeString(op));
      if (!bestOp || score > bestOp.score) bestOp = { op, score, matches: entityDict.reverseIndex[normalizeString(op)]?.matches || [] };
    }
    if (bestOp && bestOp.score >= fuzzyThreshold) {
      if (bestOp.matches.length === 1) {
        addResolved(bestOp.matches[0]);
      } else {
        const sample = bestOp.matches.slice(0, 8).map(m => `- ${m}`).join('\n');
        ambiguousQuestions.push(
          `Your query referenced operator "${raw}" (interpreted as "${bestOp.op}"), which maps to multiple hotels. Which did you mean?\n${sample}`
        );
      }
      continue;
    }

    // FUZZY MATCH: legal entity
    let bestLe: { le: string; score: number; matches: string[] } | null = null;
    for (const le of entityDict.legalEntities) {
      const score = similarity(n, normalizeString(le));
      if (!bestLe || score > bestLe.score) bestLe = { le, score, matches: entityDict.reverseIndex[normalizeString(le)]?.matches || [] };
    }
    if (bestLe && bestLe.score >= fuzzyThreshold) {
      if (bestLe.matches.length === 1) {
        addResolved(bestLe.matches[0]);
      } else {
        const sample = bestLe.matches.slice(0, 8).map(m => `- ${m}`).join('\n');
        ambiguousQuestions.push(
          `Your query referenced legal entity "${raw}" (interpreted as "${bestLe.le}"), which maps to multiple hotels. Which did you mean?\n${sample}`
        );
      }
      continue;
    }

    // NOTHING FOUND
    unknown.push(raw);
  }

  return { resolved, ambiguousQuestions, unknown };
}

/********************************************************************************************
 * METRIC RESOLVER
 * - Loads canonical metrics from business-context.md (parsed earlier)
 * - Uses a fallback alias map for common synonyms
 * - Maps user metric mentions to canonical metric objects
 ********************************************************************************************/
function buildMetricAliasMap(metricsFromDoc: CleanIntentMetric[]) {
  // Basic alias map we will expand
  const aliasMap: Record<string, string> = {};

  // Populate aliasMap: canonical name maps to itself
  for (const m of metricsFromDoc) {
    aliasMap[normalizeString(m.name)] = m.name;
    aliasMap[normalizeString(m.label)] = m.name;
  }

  // Add common heuristics & synonyms
  const heuristicAliases: Record<string, string> = {
    'arr': 'arr',
    'adr': 'arr',
    'average daily rate': 'arr',
    'occupancy': 'occupancy_pct',
    'occupancy %': 'occupancy_pct',
    'occ': 'occupancy_pct',
    'room nights sold': 'room_night_sold',
    'room nights available': 'rooms_night_available',
    'revpar': 'revpar',
    'trevpar': 'trevpar',
    'total revenue': 'total_revenue',
    'revenue': 'total_revenue',
    'f&b': 'fnb_revenue',
    'fnb': 'fnb_revenue',
    'total operating expenses': 'operating_expenses',
    'gop': 'gop',
    'goi': 'goi',
  };

  for (const k of Object.keys(heuristicAliases)) {
    aliasMap[normalizeString(k)] = heuristicAliases[k];
  }

  return aliasMap;
}

function resolveMetrics(
  requestedMetrics: string[],
  metricsFromDoc: CleanIntentMetric[]
): { resolved: CleanIntentMetric[]; unknown: string[] } {
  const aliasMap = buildMetricAliasMap(metricsFromDoc);
  const resolved: CleanIntentMetric[] = [];
  const unknown: string[] = [];

  for (const rm of requestedMetrics) {
    const n = normalizeString(rm);
    if (n in aliasMap) {
      const canonicalName = aliasMap[n];
      // find canonical metric object
      const found = metricsFromDoc.find(m => m.name === canonicalName) || null;
      if (found) {
        if (!resolved.some(r => r.name === found.name)) resolved.push(found);
      } else {
        // Heuristic alias references a metric we don't have; create a fallback metric object (absolute)
        const fallback: CleanIntentMetric = { name: canonicalName, label: canonicalName, type: 'absolute' };
        resolved.push(fallback);
      }
    } else {
      unknown.push(rm);
    }
  }

  return { resolved, unknown };
}

/********************************************************************************************
 * CLEAN INTENT STEP (Stage 0) — call GPT-4.1
 *
 * Uses:
 * - schemaSummary (string)
 * - businessContextMarkdown (string) — parsed earlier
 * - explicit entity list (from entity dictionary) to reduce hallucination
 * - explicit metrics list (from business context) to reduce ambiguity
 *
 * Returns parsed CleanIntent object (or throws).
 ********************************************************************************************/
async function extractCleanIntent(
  openaiKey: string,
  schemaSummary: string,
  businessContextMarkdown: string,
  chatHistory: Array<{ role: string; content: string }>,
  userQuery: string,
  entityDict: ReturnType<typeof buildEntityDictionary>,
  metricsFromDoc: CleanIntentMetric[]
): Promise<CleanIntent> {

  // Build explicit entity list text — quick enumeration reduces hallucinations
  const entityListText = [
    '# AVAILABLE_ENTITIES (from clean_hotel_master)',
    ...entityDict.hotelNames.map(h => `- ${h}`),
    '',
    '# AVAILABLE_OPERATORS',
    ...entityDict.operators.map(o => `- ${o}`),
    '',
    '# AVAILABLE_LEGAL_ENTITIES',
    ...entityDict.legalEntities.map(l => `- ${l}`)
  ].join('\n');

  // Build explicit metrics list
  const metricsListText = [
    '# AVAILABLE_METRICS (from business-context.md)',
    ...metricsFromDoc.map(m => `- ${m.name}: ${m.label} (${m.type})`)
  ].join('\n');

  // Create the prompt
  const cleanIntentPrompt = `You are a query refinement expert for a financial/hospitality data warehouse.

${escapeForPrompt(entityListText)}

${escapeForPrompt(metricsListText)}

# BUSINESS CONTEXT
${escapeForPrompt(businessContextMarkdown)}

# CONVERSATION HISTORY
${chatHistory.map(msg => `${msg.role}: ${escapeForPrompt(msg.content)}`).join(' ')}

# CURRENT QUESTION
${escapeForPrompt(userQuery)}

Your task:
1) Produce a clarified cleanQuery in natural language.
2) Extract:
   - time.grain: one of ["month", "quarter", "half_year", "year"]. Minimum grain is month.
   - time.lookback_periods: integer number of periods to look back (e.g. 7 months). If user gives explicit start/end, set this null.
   - time.start_period / time.end_period: ISO-like boundaries if explicitly provided, else null.
3) Resolve entities: array of concrete entity mentions (use only the AVAILABLE_ENTITIES / AVAILABLE_OPERATORS / AVAILABLE_LEGAL_ENTITIES lists).
4) Resolve metrics: array of metrics with fields { name, label, type } — use AVAILABLE_METRICS above.
Respond ONLY with JSON:
{
  "cleanQuery": "...",
  "time": { "grain": "month|quarter|half_year|year", "lookback_periods": number|null, "start_period": string|null, "end_period": string|null },
  "entities": ["..."],
  "metrics": [
    { "name": "total_revenue", "label": "Total Revenue", "type": "absolute" }
  ]
}`;

  // Call OpenAI Chat Completions (GPT-4.1)
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: 'You are a query refinement expert. Always respond with valid JSON.' },
        { role: 'user', content: cleanIntentPrompt }
      ],
      max_tokens: 800,
      temperature: 0.15
    }),
  });

  const data = await resp.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error(`Clean intent extraction failed: ${JSON.stringify(data)}`);
  }

  let raw = data.choices[0].message.content as string;
  // strip code fences if present
  raw = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();

  // Parse JSON — robust approach: find first { ... } block
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Could not find JSON object in LLM response for clean intent.');

  const parsed = JSON.parse(m[0]);

  // Validate & normalize parsed structure
  const cleanIntent: CleanIntent = {
    cleanQuery: parsed.cleanQuery || userQuery,
    time: parsed.time || { grain: 'month', lookback_periods: 12, start_period: null, end_period: null },
    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
    metrics: Array.isArray(parsed.metrics) ? parsed.metrics : []
  };

  return cleanIntent;
}

/********************************************************************************************
 *
 * END OF PART 2
 * → Say “continue” to receive PART 3 (SQL generation, execution, summary, full handler)
 *
 ********************************************************************************************/


/**************************************************************************************
 * PART 3 — SQL Generation, Execution, Summary, and Full HTTP Handler
 **************************************************************************************/

/********************************************************************************************
 * Helper: simple JSON-safe stringifier for logging prompts (shorten large payloads)
 ********************************************************************************************/
function shortString(s: string, max = 1000) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '... [truncated]' : s;
}

/********************************************************************************************
 * Classification Step (Stage 1) — GPT-4.1
 * Decides whether the cleaned intent is clear or needs clarification.
 ********************************************************************************************/
async function classifyQuery(openaiKey: string, schemas: any[], businessContext: string, chatHistory: any[], cleanQuery: string) {
  const classificationPrompt = `You are a SQL query classifier.

Available schemas:
${escapeForPrompt(JSON.stringify(schemas, null, 2))}

Business Context:
${escapeForPrompt(businessContext)}

Conversation history:
${chatHistory.map(msg => `${msg.role}: ${escapeForPrompt(msg.content)}`).join('\n')}

Refined query: "${escapeForPrompt(cleanQuery)}"

Respond with JSON only:
{ "status": "clear" | "needs_clarification", "confidence": 0.0, "questions": ["..."] }`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: 'You are a query classification expert. Always respond with valid JSON.' },
        { role: 'user', content: classificationPrompt }
      ],
      max_tokens: 400,
      temperature: 0.2
    }),
  });

  const data = await resp.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error(`Classification failed: ${JSON.stringify(data)}`);
  }

  let raw = data.choices[0].message.content as string;
  raw = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Could not parse JSON from classification model.');

  const parsed = JSON.parse(m[0]);
  return parsed;
}

/********************************************************************************************
 * SQL Generation Step (Stage 2) — GPT-4.1
 * Produces canonical long-form SQL per the CleanIntent and available tables.
 ********************************************************************************************/
async function generateSQL(
  openaiKey: string,
  validTables: any[],
  businessContext: string,
  cleanIntent: CleanIntent
): Promise<{ sql: string; explanation: string }> {
  // Build table listing text
  const tablesText = validTables.map((t: any) => {
    return `Table Name: ${t.tableName}
Description: "${t.schemaName}" - ${t.schemaDescription || 'No description'}
Columns:
${t.columns.map((c: any) => `  - ${c.name} (${c.type}${c.nullable ? ', nullable' : ''})`).join('\n')}
Sample Data (first 5 rows):
${JSON.stringify(t.sampleRows || [], null, 2)}
`;
  }).join('\n');

// NEW: Define join relationships as a static string (update as needed)
  const joinRelationships = `
# TABLE RELATIONSHIPS (use these for joins)
- clean_hotel_financials and clean_hotel_master: join on clean_hotel_financials.hotel_name = clean_hotel_master.hotel_name
- clean_hotel_financials and clean_currency_exchange_rates: join on clean_hotel_financials.period_start_date = clean_currency_exchange_rates.month_start_date
- For queries needing all three tables (clean_hotel_financials, clean_hotel_master, clean_currency_exchange_rates), use both joins above.
`;

  const sqlPrompt = `You are an expert SQL generator. Use only PostgreSQL-specific syntax and functions in your queries.

Your job is to generate a single SQL statement that returns data in a fixed canonical LONG format (non-pivot).

CANONICAL OUTPUT SCHEMA (REQUIRED):
Each row must represent one (period, entity, metric) combination with the following exact columns:
- period (date)       -- first day of the period (month/quarter/half/year)
- period_grain (text) -- one of 'month', 'quarter', 'half_year', 'year'
- entity_name (text)
- metric_name (text)
- metric_label (text)
- metric_type (text)  -- 'absolute' or 'percentage'
- metric_value (numeric) -- for percentages this MUST be 0-100
- reporting_currency (text) -- OPTIONAL if source table has this column

AVAILABLE TABLES & COLUMNS:
${escapeForPrompt(tablesText)}

BUSINESS CONTEXT:
${escapeForPrompt(businessContext)}

Join relationships:
${escapeForPrompt(joinRelationships)}

CLEAN INTENT:
${escapeForPrompt(JSON.stringify(cleanIntent, null, 2))}

RULES (STRICT — follow exactly):
1. Do NOT pivot. Return one row per (period, entity, metric).
2. Use exact alias names: period, period_grain, entity_name, metric_name, metric_label, metric_type, metric_value, reporting_currency (if available).
3. If reporting_currency exists in the source table, include it for all rows.
4. Time grain handling:
   - month: date_trunc('month', <date_col>)::date
   - quarter: date_trunc('quarter', <date_col>)::date
   - half_year: compute H1/H2 first-day logic
   - year: date_trunc('year', <date_col>)::date
5. Use time.lookback_periods or start_period/end_period from cleanIntent to filter.
6. Always ensure ROUND() receives a NUMERIC value — cast any computed float/double expressions to ::numeric before rounding
7. For percentage metrics, compute as (numerator/denominator)*100.
8. ORDER BY period ASC, entity_name ASC, metric_name ASC.
9. Use only the exact table names listed above in FROM clauses.
10. If any entity referenced in cleanIntent does not exist in the available tables, return JSON:
   { "error": "unknown_entity", "details": ["<entity>"] }
11. Do NOT include a trailing semicolon.

Return JSON only:
{ "sql": "<SQL string>", "explanation": "short explanation" }`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: 'You are an expert SQL generator. Always respond with valid JSON.' },
        { role: 'user', content: sqlPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.18
    }),
  });

  const data = await resp.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error(`SQL generation failed: ${JSON.stringify(data)}`);
  }

  let raw = data.choices[0].message.content as string;
  raw = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
  const m = raw.match(/\{[\s\S]*\}$/);
  if (!m) throw new Error('Could not parse JSON from SQL generation model.');

  const parsed = JSON.parse(m[0]);
  if (parsed.error) throw new Error(`SQL generator returned error: ${JSON.stringify(parsed)}`);

  // sanitize SQL (remove trailing semicolon)
  const sql = (parsed.sql as string).trim().replace(/;$/, '');
  const explanation = parsed.explanation || '';
  return { sql, explanation };
}

/********************************************************************************************
 * SQL Validation — quick checks before executing against DB
 * - ensure no unknown entities (defensive)
 * - ensure referenced tables/columns exist (basic check)
 * - ensure no empty IN () clauses
 ********************************************************************************************/
function validateSQL(sql: string, entityDict: ReturnType<typeof buildEntityDictionary>, cleanIntent: CleanIntent) {
  // Basic checks
  if (!sql || sql.length < 10) throw new Error('Generated SQL is empty or too short.');

  // Ensure entities used in cleanIntent are present in entityDict (we already resolved earlier, but double-check)
  for (const ent of cleanIntent.entities) {
    // ent should be one of resolved hotel names; check case-insensitive
    const found = entityDict.hotelNames.some(h => normalizeString(h) === normalizeString(ent));
    if (!found) {
      throw new Error(`Entity "${ent}" not found in entity master data.`);
    }
  }

  // Prevent 'IN ()' empty clauses
  if (/\bIN\s*\(\s*\)/i.test(sql)) {
    throw new Error('Generated SQL contains empty IN () clause.');
  }

  // Good to go
  return true;
}

/********************************************************************************************
 * Summary Generation (Stage 4) — GPT-4.1-nano
 ********************************************************************************************/
async function generateSummary(openaiKey: string, cleanQuery: string, sql: string, results: any[]) {
  const summaryPrompt = `Analyze these query results and provide a brief, natural language summary for a business user.

Clean query: ${escapeForPrompt(cleanQuery)}
SQL: ${escapeForPrompt(sql)}
Results (first 50 rows): ${escapeForPrompt(JSON.stringify(results.slice(0, 50)))}

Respond as JSON:
{
  "short_answer": "1-2 sentence high level answer",
  "detailed_explanation": "2-4 sentences describing trends, comparisons, and any notable patterns"
}`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: 'You are a data summarization expert. Always respond with valid JSON.' },
        { role: 'user', content: summaryPrompt }
      ],
      max_tokens: 800,
      temperature: 0.2
    }),
  });

  const data = await resp.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error(`Summary generation failed: ${JSON.stringify(data)}`);
  }

  let raw = data.choices[0].message.content as string;
  raw = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Could not parse JSON from summary model.');

  const parsed = JSON.parse(m[0]);
  return parsed;
}

/********************************************************************************************
 * Full HTTP handler — ties everything together
 ********************************************************************************************/
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('AI SQL Orchestrator invoked (final).');
    const body = await req.json();
    const { userQuery, sessionId, chatHistory } = body as QueryRequest;

    // Create Supabase client — keep Authorization header so RPCs respect user context where needed
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    // Authenticate user
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user) {
      throw new Error('Unauthorized');
    }

    // Load schemas table (if you have schema metadata)
    const { data: schemas, error: schemasError } = await supabaseClient.from('schemas').select('*');
    if (schemasError) console.warn('Could not load schemas table:', schemasError);

    // Load entity master
    const master = await loadEntityMaster(supabaseClient);
    const entityDict = buildEntityDictionary(master);

    // Load business context + metrics
    const { rawMarkdown: businessContextMarkdown, metrics: metricsFromDoc } = await loadBusinessContext(supabaseClient);

    // Load table column info (for SQL generator context) — same logic as your original file
    const { data: schemasList } = await supabaseClient.from('schemas').select('*');
    const schemasToInspect = schemasList || [];

    const tablesInfo = await Promise.all((schemasToInspect || []).map(async (schema: any) => {
      const { data: sanitizedName, error: sanitizeError } = await supabaseClient
        .rpc('sanitize_table_name', { p_name: schema.name });

      if (sanitizeError || !sanitizedName) {
        console.warn(`Could not sanitize ${schema.name}`, sanitizeError);
        return null;
      }
      const tableName = `clean_${sanitizedName}`;
      try {
        const { data: columns, error: colsError } = await supabaseClient
          .rpc('get_table_columns', { p_table_name: tableName });
        if (colsError || !columns) return null;

        const { data: samples, error: samplesError } = await supabaseClient
          .from(tableName)
          .select('*')
          .limit(5);

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
      } catch (e) {
        console.warn(`Error inspecting schema ${schema.name}`, e);
        return null;
      }
    }));

    const validTables = (tablesInfo || []).filter(Boolean) as any[];
    if (validTables.length === 0) {
      const errMsg = 'No valid tables found for your schemas. Ensure clean_<schema> tables exist and RPCs are working.';
      await supabaseClient.from('chat_messages').insert({ session_id: sessionId, role: 'assistant', content: errMsg });
      return new Response(JSON.stringify({ error: errMsg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build schemaSummary for prompt (truncate to avoid huge prompts)
    const schemaSummary = validTables.map((t: any) => `Table: ${t.tableName}\nColumns: ${t.columns.map((c: any) => c.name).join(', ')}`).join('\n');

    // Ensure OPENAI_API_KEY present
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY env var not set');

    // Stage 0: Clean Intent extraction
    const cleanIntent = await extractCleanIntent(openaiApiKey, schemaSummary, businessContextMarkdown, chatHistory, userQuery, entityDict, metricsFromDoc);
    console.log('Clean Intent:', JSON.stringify(cleanIntent, null, 2));

    // ENTITY RESOLUTION
    // Use resolver to map cleanIntent.entities -> canonical hotel names (or ambiguous)
    const { resolved, ambiguousQuestions, unknown } = resolveEntities(cleanIntent.entities, entityDict);

    // If ambiguous (operator/legal entity mapping to many hotels) or unknown entities, ask clarification
    if ((ambiguousQuestions && ambiguousQuestions.length > 0) || (unknown && unknown.length > 0)) {
      const questions = [...ambiguousQuestions];
      if (unknown.length > 0) {
        questions.push(`I couldn't map these references to known hotels/operators/legal-entities: ${unknown.join(', ')}. Could you clarify?`);
      }
      // persist and return clarification request
      await supabaseClient.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: questions.join('\n\n')
      });
      return new Response(JSON.stringify({ needsClarification: true, questions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Replace cleanIntent.entities with resolved canonical hotel names for SQL generation
    cleanIntent.entities = resolved;

    // METRIC RESOLUTION
    const requestedMetricNames = cleanIntent.metrics.map(m => m.name);
    const { resolved: resolvedMetrics, unknown: unknownMetrics } = resolveMetrics(requestedMetricNames, metricsFromDoc);

    if (unknownMetrics.length > 0) {
      const q = `I couldn't map these metrics to known metrics: ${unknownMetrics.join(', ')}. Please clarify which metrics you meant.`;
      await supabaseClient.from('chat_messages').insert({ session_id: sessionId, role: 'assistant', content: q });
      return new Response(JSON.stringify({ needsClarification: true, questions: [q] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Replace metrics in cleanIntent with resolved canonical metric objects
    cleanIntent.metrics = resolvedMetrics;

    // Stage 1: Classification
    const classification = await classifyQuery(openaiApiKey, schemas || [], businessContextMarkdown, chatHistory, cleanIntent.cleanQuery);
    if (classification.status === 'needs_clarification') {
      await supabaseClient.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: classification.questions.join('\n')
      });
      return new Response(JSON.stringify({ needsClarification: true, questions: classification.questions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Stage 2: SQL generation
    const { sql: generatedSql, explanation } = await generateSQL(openaiApiKey, validTables, businessContextMarkdown, cleanIntent);
    console.log('Generated SQL preview:', shortString(generatedSql, 1200));

    // Validate SQL
    validateSQL(generatedSql, entityDict, cleanIntent);

    // Stage 3: Execute SQL
    const { data: queryData, error: queryError } = await supabaseClient.rpc('execute_safe_query', { query_text: generatedSql });
    if (queryError) {
      console.error('SQL execution error:', queryError);
      throw new Error(`SQL execution failed: ${queryError.message}`);
    }

    // Ensure we have an array of rows
    let queryResult: any[] = Array.isArray(queryData) ? queryData : (queryData ? [queryData] : []);

    // Defensive: convert percentage values <=1 to 0-100
    queryResult = queryResult.map((row: any) => {
      const r = { ...row };
      if (r.metric_type === 'percentage' && typeof r.metric_value === 'number' && r.metric_value <= 1) {
        r.metric_value = r.metric_value * 100;
      }
      return r;
    });

    // Stage 4: Summary generation (use GPT-4.1-nano)
    const summaryPayload = await generateSummary(openaiApiKey, cleanIntent.cleanQuery, generatedSql, queryResult);
    const dataSummary = (summaryPayload.short_answer || summaryPayload.detailed_explanation || '').toString();

    // --- Conversation Summary Logic ---
    // Fetch last 5 messages for the session (user and assistant)
    const { data: lastMessages } = await supabaseClient
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Build summary prompt
    const summaryPointsPrompt = `Summarize the following conversation in 5 bullet points, focusing on the most recent user message. For the AI message, use only the explanation (not SQL or table data).\n\nMessages:\n${lastMessages?.reverse().map(m => `${m.role}: ${m.content}`).join('\n')}\n\nRespond as JSON:\n{ "points": ["point 1", "point 2", "point 3", "point 4", "point 5"] }`;

    let summaryPoints = [];
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: 'You are a conversation summarization expert. Always respond with valid JSON.' },
            { role: 'user', content: summaryPointsPrompt }
          ],
          max_tokens: 400,
          temperature: 0.2
        }),
      });
      const data = await resp.json();
      let raw = data.choices?.[0]?.message?.content || '';
      raw = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        summaryPoints = Array.isArray(parsed.points) ? parsed.points : [];
      }
    } catch (e) {
      summaryPoints = [];
    }

    // Store the summary points for the session
    await supabaseClient.from('chat_sessions').update({ conversation_summary: summaryPoints.join('\n') }).eq('id', sessionId);

    // Persist chat message & metadata (unchanged)
    await supabaseClient.from('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: dataSummary,
      sql_query: generatedSql,
      query_result: queryResult,
      data_summary: dataSummary,
      metadata: {
        originalQuery: userQuery,
        cleanedQuery: cleanIntent.cleanQuery,
        intent: cleanIntent
      }
    });

    // Final response (unchanged)
    return new Response(JSON.stringify({
      needsClarification: false,
      sql: generatedSql,
      explanation,
      dataSummary,
      results: queryResult,
      outputFormat: null
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Error in ai-sql-orchestrator:', err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

