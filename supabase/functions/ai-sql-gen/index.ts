/********************************************************************************************
 * AI SQL ORCHESTRATOR — UPGRADED VERSION WITH:
 * - SQL ENGINE VERSION SWITCH (v1 / v2)
 * - FULL 2-STAGE SQL VALIDATOR (syntax + semantic) + GPT RECTIFICATION LOOP
 * - FX FALLBACK INSTRUCTIONS
 * 
 * PART 1/4 — Imports, Constants, Utilities, Business Context Loader
 ********************************************************************************************/

// 🟦 VERSION SWITCH — You can manually set to "v2"
const SQL_ENGINE_VERSION: "v1" | "v2" = "v1";

/********************************************************************************************
 * IMPORTS
 ********************************************************************************************/
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

// SQL validator dependencies
import * as PgAst from "https://esm.sh/pgsql-ast-parser@12";
import initSqlJs from "https://esm.sh/sql.js@1.10.2";
import { enrichQuery, EnrichedQuery } from "./queryEnricher.ts";

/********************************************************************************************
 * CORS HEADERS
 ********************************************************************************************/


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true"
};


/********************************************************************************************
 * REQUEST INTERFACES
 ********************************************************************************************/
interface QueryRequest {
  userQuery: string;
  sessionId: string;
  chatHistory: Array<{ role: string; content: string }>;
}

/********************************************************************************************
 * CANONICAL OUTPUT FORMAT (Long Format)
 ********************************************************************************************/
interface CanonicalRow {
  period: string;
  period_grain: "month" | "quarter" | "half_year" | "year";
  entity_name: string;
  metric_name: string;
  metric_label: string;
  metric_type: "absolute" | "percentage";
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
  type: "absolute" | "percentage";
}

interface CleanIntentTime {
  grain: "month" | "quarter" | "half_year" | "year";
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
 ********************************************************************************************/
function escapeForPrompt(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ");
}

/********************************************************************************************
 * UTILITY: levenshteinDistance + similarity
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
        dp[i - 1][j] + 1, //
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const dist = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

/********************************************************************************************
 * LOAD BUSINESS CONTEXT (#metrics parsing)
 ********************************************************************************************/
async function loadBusinessContext(supabase: any): Promise<{
  rawMarkdown: string;
  metrics: CleanIntentMetric[];
}> {
  try {
    const { data: fileData, error } = await supabase.storage
      .from("business-context-docs")
      .download("business-context.md");

    if (error || !fileData) return { rawMarkdown: "", metrics: [] };

    const markdown = await fileData.text();

    const metricSectionMatch = markdown.match(/#metrics([\s\S]*?)(#|$)/i);
    let metrics: CleanIntentMetric[] = [];

    if (metricSectionMatch) {
      const lines = metricSectionMatch[1]
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("-"));

      metrics = lines
        .map((line) => {
          const clean = line.replace(/^-/, "").trim();
          const parts = clean.split(":");
          if (parts.length < 2) return null;

          const name = parts[0].trim();
          const rest = parts.slice(1).join(":").trim();

          const typeMatch = rest.match(/\((absolute|percentage)\)/i);
          const type = typeMatch
            ? (typeMatch[1].toLowerCase() as "absolute" | "percentage")
            : "absolute";

          const label = rest.replace(
            /\(absolute\)|\(percentage\)/gi,
            ""
          ).trim();

          return { name, label, type };
        })
        .filter(Boolean) as CleanIntentMetric[];
    }

    return { rawMarkdown: markdown, metrics };
  } catch {
    return { rawMarkdown: "", metrics: [] };
  }
}

/********************************************************************************************
 * LOAD ENTITY MASTER (hotel_name, operator, legal_entity)
 ********************************************************************************************/
async function loadEntityMaster(supabase: any) {
  const { data, error } = await supabase
    .from("clean_hotel_master")
    .select("hotel_name, operator, legal_entity");

  if (error || !data) return [];
  return data as Array<{
    hotel_name: string;
    operator: string;
    legal_entity: string;
  }>;
}

/********************************************************************************************
 * BUILD ENTITY DICTIONARY
 ********************************************************************************************/
function buildEntityDictionary(master: any[]) {
  const hotelNames = master.map((r) => r.hotel_name).filter(Boolean);

  const operators = Array.from(
    new Set(master.map((r) => r.operator).filter(Boolean))
  );

  const legalEntities = Array.from(
    new Set(master.map((r) => r.legal_entity).filter(Boolean))
  );

  const reverseIndex: Record<string, { type: string; matches: string[] }> = {};

  for (const r of master) {
    const h = r.hotel_name.toLowerCase();
    reverseIndex[h] = { type: "hotel_name", matches: [r.hotel_name] };

    const o = r.operator?.toLowerCase();
    if (o) {
      if (!reverseIndex[o]) reverseIndex[o] = { type: "operator", matches: [] };
      reverseIndex[o].matches.push(r.hotel_name);
    }

    const le = r.legal_entity?.toLowerCase();
    if (le) {
      if (!reverseIndex[le])
        reverseIndex[le] = { type: "legal_entity", matches: [] };
      reverseIndex[le].matches.push(r.hotel_name);
    }
  }

  return { hotelNames, operators, legalEntities, reverseIndex };
}

/********************************************************************************************
 * PART 1 ENDS HERE
 * — Say “continue with PART 2”
 ********************************************************************************************/

/********************************************************************************************
 * PART 2/4 — ENTITY RESOLVER, METRIC RESOLVER, CLEAN INTENT, CLASSIFICATION
 ********************************************************************************************/

/********************************************************************************************
 * HELPER: normalizeString
 ********************************************************************************************/
function normalizeString(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/********************************************************************************************
 * ENTITY RESOLVER
 ********************************************************************************************/
function resolveEntities(
  rawEntities: string[],
  entityDict: ReturnType<typeof buildEntityDictionary>,
  options: { fuzzyThreshold?: number; ambiguityDelta?: number } = {}
) {
  const fuzzyThreshold = options.fuzzyThreshold ?? 0.78;
  const resolved: string[] = [];
  const ambiguousQuestions: string[] = [];
  const unknown: string[] = [];

  const normHotels = entityDict.hotelNames.map(normalizeString);

  const hotelMap: Record<string, string> = {};
  entityDict.hotelNames.forEach((h) => (hotelMap[normalizeString(h)] = h));

  // Helper
  const addResolved = (h: string) => {
    if (!resolved.includes(h)) resolved.push(h);
  };

  for (const raw of rawEntities) {
    const n = normalizeString(raw);

    // Exact match hotel
    if (hotelMap[n]) {
      addResolved(hotelMap[n]);
      continue;
    }

    // Exact operator → multiple hotels
    if (entityDict.operators.map(normalizeString).includes(n)) {
      const matches =
        entityDict.reverseIndex[n]?.matches || [];
      if (matches.length === 1) addResolved(matches[0]);
      else {
        ambiguousQuestions.push(
          `The operator "${raw}" maps to multiple hotels:\n` +
            matches.map((m) => `- ${m}`).join("\n")
        );
      }
      continue;
    }

    // Exact legal entity → multiple hotels
    if (entityDict.legalEntities.map(normalizeString).includes(n)) {
      const matches =
        entityDict.reverseIndex[n]?.matches || [];
      if (matches.length === 1) addResolved(matches[0]);
      else {
        ambiguousQuestions.push(
          `The legal entity "${raw}" maps to multiple hotels:\n` +
            matches.map((m) => `- ${m}`).join("\n")
        );
      }
      continue;
    }

    // Fuzzy hotel
    let best: { h: string; score: number } | null = null;
    for (const h of entityDict.hotelNames) {
      const score = similarity(n, normalizeString(h));
      if (!best || score > best.score) {
        best = { h, score };
      }
    }
    if (best && best.score >= fuzzyThreshold) {
      addResolved(best.h);
      continue;
    }

    unknown.push(raw);
  }

  return { resolved, ambiguousQuestions, unknown };
}

/********************************************************************************************
 * METRIC RESOLVER
 ********************************************************************************************/
function buildMetricAliasMap(metrics: CleanIntentMetric[]) {
  const alias: Record<string, string> = {};

  for (const m of metrics) {
    alias[normalizeString(m.name)] = m.name;
    alias[normalizeString(m.label)] = m.name;
  }

  // Common synonyms
  const synonyms: Record<string, string> = {
    arr: "arr",
    adr: "arr",
    "average daily rate": "arr",
    occupancy: "occupancy_pct",
    "occupancy %": "occupancy_pct",
    occ: "occupancy_pct",
    "room nights sold": "room_night_sold",
    "rooms sold": "room_night_sold",
    revpar: "revpar",
    trevpar: "trevpar",
    revenue: "total_revenue",
    "total revenue": "total_revenue",
  };

  for (const k in synonyms) {
    alias[normalizeString(k)] = synonyms[k];
  }

  return alias;
}

function resolveMetrics(
  requested: string[],
  metricsFromDoc: CleanIntentMetric[]
) {
  const alias = buildMetricAliasMap(metricsFromDoc);
  const resolved: CleanIntentMetric[] = [];
  const unknown: string[] = [];

  for (const r of requested) {
    const n = normalizeString(r);
    if (alias[n]) {
      const canonical = alias[n];
      const found = metricsFromDoc.find((m) => m.name === canonical);
      if (found) {
        if (!resolved.find((m) => m.name === found.name)) resolved.push(found);
      } else {
        // fallback synthetic metric
        resolved.push({
          name: canonical,
          label: canonical,
          type: "absolute",
        });
      }
    } else {
      unknown.push(r);
    }
  }

  return { resolved, unknown };
}

/********************************************************************************************
 * CLEAN INTENT EXTRACTION (GPT)
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
  const entityList = [
    "# HOTELS",
    ...entityDict.hotelNames.map((h) => `- ${h}`),
    "",
    "# OPERATORS",
    ...entityDict.operators.map((o) => `- ${o}`),
    "",
    "# LEGAL ENTITIES",
    ...entityDict.legalEntities.map((l) => `- ${l}`),
  ].join("\n");

  const metricsList = [
    "# METRICS",
    ...metricsFromDoc.map(
      (m) => `- ${m.name}: ${m.label} (${m.type})`
    ),
  ].join("\n");

  const prompt = `
You are a query refinement expert for a hospitality financial warehouse.

VERSION OF SQL ENGINE = "${SQL_ENGINE_VERSION}"

${escapeForPrompt(entityList)}

${escapeForPrompt(metricsList)}

BUSINESS CONTEXT:
${escapeForPrompt(businessContextMarkdown)}

CHAT HISTORY:
${chatHistory.map((m) => `${m.role}: ${escapeForPrompt(m.content)}`).join("\n")}

USER QUERY:
"${escapeForPrompt(userQuery)}"

Extract JSON:
{
  "cleanQuery": "...",
  "time": {
    "grain": "month|quarter|half_year|year",
    "lookback_periods": number|null,
    "start_period": string|null,
    "end_period": string|null
  },
  "entities": ["..."],
  "metrics": [
    { "name": "...", "label": "...", "type": "absolute|percentage" }
  ]
}
ONLY return JSON.
`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "You are a query refinement expert. Always output valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.1,
    }),
  });

  const data = await resp.json();
  let raw = data.choices?.[0]?.message?.content ?? "";
  raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Clean Intent JSON not found");

  const parsed = JSON.parse(m[0]);

  return {
    cleanQuery: parsed.cleanQuery || userQuery,
    time: parsed.time,
    entities: parsed.entities || [],
    metrics: parsed.metrics || [],
  };
}

/********************************************************************************************
 * CLASSIFICATION (GPT)
 ********************************************************************************************/
async function classifyQuery(
  openaiKey: string,
  schemas: any[],
  businessContext: string,
  chatHistory: any[],
  cleanQuery: string
) {
  const prompt = `
Classify if the refined query is clear or needs clarification.

Query: "${escapeForPrompt(cleanQuery)}"

Respond only:
{
  "status": "clear" | "needs_clarification",
  "confidence": number,
  "questions": ["..."]
}
`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: "Always output valid JSON." },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
      temperature: 0.1,
    }),
  });

  const data = await resp.json();
  let raw = data.choices?.[0]?.message?.content ?? "";
  raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Classification JSON missing");

  return JSON.parse(m[0]);
}

/********************************************************************************************
 * END OF PART 2
 * — Say “continue with PART 3”
 ********************************************************************************************/
/********************************************************************************************
 * PART 3/4 — SQL GENERATOR WITH V1/V2 SWITCH + FULL 2-STAGE SQL VALIDATOR
 ********************************************************************************************/

/********************************************************************************************
 * HELPER — shorten long strings for logs
 ********************************************************************************************/
function shortString(s: string, max = 800) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "... [truncated]" : s;
}

/********************************************************************************************
 * GPT SQL GENERATOR (Version-aware)
 *
 * If SQL_ENGINE_VERSION = "v1":
 *   - GPT must use base tables:
 *       clean_hotel_financials
 *       clean_hotel_master
 *       clean_currency_exchange
 *
 * If SQL_ENGINE_VERSION = "v2":
 *   - GPT must use only:
 *       hotel_monthly_normalized
 *
 * FX FALLBACK RULE IS ENFORCED IN PROMPT
 ********************************************************************************************/
async function generateSQLWithVersion(
  openaiKey: string,
  validTables: any[],
  businessContext: string,
  enrichedQuery: any // Accept EnrichedQuery
): Promise<{ sql: string; explanation: string }> {
  // Build tables context based on version
  let tableContext = "";
  if (SQL_ENGINE_VERSION === "v1") {
    tableContext = validTables
      .map((t: any) => {
        return `Table Name: ${t.tableName}
Description: ${t.schemaDescription}
Columns:
${t.columns.map((c: any) => `  - ${c.name} (${c.type})`).join("\n")}
Sample Rows:
${JSON.stringify(t.sampleRows || [], null, 2)}
`;
      })
      .join("\n");
  } else {
    // VERSION v2 — Only normalized view
    const normalizedView = validTables.find(
      (t: any) => t.tableName === "hotel_monthly_normalized"
    );
    if (!normalizedView)
      throw new Error(
        "hotel_monthly_normalized not found — required for v2 mode."
      );

    tableContext = `Table Name: hotel_monthly_normalized
Description: Pre-joined normalized monthly view containing:
- period_start_date
- reporting_currency
- room_revenue_in_inr
- total_revenue_in_inr
- room_nights_sold
- room_nights_available
- quarter_label, half_label, year
FX fallback already applied.

Columns:
${normalizedView.columns
  .map((c: any) => `  - ${c.name} (${c.type})`)
  .join("\n")}

Sample Rows:
${JSON.stringify(normalizedView.sampleRows || [], null, 2)}
`;
  }

  const sqlPrompt = `
You are an expert PostgreSQL SQL generator.

- metric_label
- metric_type ('absolute'|'percentage')
- metric_value
- reporting_currency (if exists)

TIME GRAIN RULES:
- month      → date_trunc('month', period_start_date)::date
- quarter    → date_trunc('quarter', period_start_date)::date
- half_year  → if month in 1–6 → first day of that year; else first day of July
- year       → date_trunc('year', period_start_date)::date

FX FALLBACK RULE (v1 only):
When converting currency:
COALESCE(
   fx.rate,
   (
     SELECT fx2.rate
     FROM clean_currency_exchange fx2
${escapeForPrompt(tableContext)}

${escapeForPrompt(JSON.stringify(enrichedQuery, null, 2))}

STRICT RULES:
1. Always return rows in canonical LONG format — one row per (period, entity, metric).
2. If VERSION = "v1": you MUST use joins across clean_hotel_financials + clean_hotel_master + clean_currency_exchange. Compute derived fields monthly → aggregate.
3. If VERSION = "v2": you MUST use ONLY hotel_monthly_normalized.
4. Percentage metrics MUST be *100 scaled* (not 0–1).
5. ORDER BY period ASC, entity_name ASC, metric_name ASC.
6. Do NOT pivot.
7. SQL only — no prose.
8. Do NOT include a trailing semicolon.

<IMPORTANT DO NOT IGNORE> 
ROUNDING RULE (PostgreSQL):
If you need to round a double precision value to N decimal places, cast it to numeric first:
round(value::numeric, N)
Do NOT use round(double precision, integer) directly.
<IMPORTANT DO NOT IGNORE>

Return JSON:
{
  "sql": "...",
  "explanation": "..."
}
`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: "You are an expert SQL generator. Return JSON only." },
        { role: "user", content: sqlPrompt },
      ],
      max_tokens: 1800,
      temperature: 0.15,
    }),
  });

  const data = await resp.json();
  let raw = data.choices?.[0]?.message?.content ?? "";
  raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  const m = raw.match(/\{[\s\S]*\}$/);
  if (!m) throw new Error("SQL generator did not return JSON");

  const parsed = JSON.parse(m[0]);
  const sql = parsed.sql.trim().replace(/;$/, "");
  return { sql, explanation: parsed.explanation || "" };
}

/********************************************************************************************
 * SQL VALIDATION — Stage 1: Syntax (pgsql-ast-parser)
 ********************************************************************************************/
function validateSyntax(sql: string) {
  try {
    PgAst.parse(sql);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}


/********************************************************************************************
 * HELPER — map SQL types to SQLite for semantic validation
 ********************************************************************************************/
function mapPgTypeToSQLite(t: string) {
  const L = t.toLowerCase();
  if (L.includes("int")) return "INTEGER";
  if (L.includes("numeric") || L.includes("decimal") || L.includes("float"))
    return "REAL";
  if (L.includes("date")) return "TEXT";
  return "TEXT";
}

/********************************************************************************************
 * SQL VALIDATION — Stage 2: Semantic (sql.js in-memory engine)
 ********************************************************************************************/
async function validateSemantics(sql: string, tableSchemas: any[]) {
  const SQL = await initSqlJs({
    locateFile: (f: string) =>
      `https://esm.sh/sql.js@1.10.2/dist/${f}`,
  });

  const db = new SQL.Database();

  // Build virtual tables
  for (const t of tableSchemas) {
    const cols = t.columns
      .map((c: any) => `${c.name} ${mapPgTypeToSQLite(c.type)}`)
      .join(",");
    try {
      db.run(`CREATE TABLE ${t.tableName} (${cols});`);
    } catch (e) {
      return { ok: false, error: "Failed to create virtual table: " + t.tableName };
    }
  }

  // Validate by EXPLAIN
  try {
    db.exec(`EXPLAIN ${sql}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

/********************************************************************************************
 * GPT-based RECTIFICATION of failing SQL
 ********************************************************************************************/
async function rectifySQL(
  openaiKey: string,
  failingSql: string,
  validatorMessage: string,
  tableSchemas: any[],
  cleanIntent: CleanIntent
) {
  const prompt = `
You are an expert SQL repair system.

Fix the SQL below. Keep structure intact. Only correct the error.
Return SQL ONLY.

Failing SQL:
${failingSql}

Validator Error:
${validatorMessage}

Table Schemas:
${JSON.stringify(tableSchemas, null, 2)}

Intent:
${JSON.stringify(cleanIntent, null, 2)}

REQUIREMENTS:
- Do NOT rewrite everything.
- Fix ONLY the invalid part.
- Output raw SQL string (no code fences, no JSON).
`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [{ role: "system", content: "You output fixed SQL only." }, { role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.1,
    }),
  });

  const data = await resp.json();
  let out = data.choices?.[0]?.message?.content ?? "";
  return out.replace(/```sql/g, "").replace(/```/g, "").trim();
}

/********************************************************************************************
 * FULL VALIDATION PIPELINE (syntax → semantic → rectify → repeat)
 ********************************************************************************************/
async function validateAndRectifySQL(
  openaiKey: string,
  originalSql: string,
  enrichedQuery: any,
  tableSchemas: any[]
): Promise<{ validatedSql: string; attempts: any[] }> {

  let sql = originalSql;
  const attempts: any[] = [];

  for (let i = 0; i < 2; i++) {
    // 1. SYNTAX CHECK
    const syntax = validateSyntax(sql);
    if (!syntax.ok) {
      attempts.push({ stage: "syntax", error: syntax.error });
      sql = await rectifySQL(openaiKey, sql, syntax.error, tableSchemas, enrichedQuery);
      continue;
    }

    // 2. SEMANTIC CHECK
    const semantic = await validateSemantics(sql, tableSchemas);
    if (!semantic.ok) {
      attempts.push({ stage: "semantic", error: semantic.error });
      sql = await rectifySQL(openaiKey, sql, semantic.error, tableSchemas, enrichedQuery);
      continue;
    }

    // VALID
    return { validatedSql: sql, attempts };
  }

  // If still failing after two attempts:
  return {
    validatedSql: sql, // best effort
    attempts,
  };
}

/********************************************************************************************
 * END OF PART 3
 * — Say “continue with PART 4”
 ********************************************************************************************/
/********************************************************************************************
 * PART 4/4 — FULL HTTP HANDLER
 * Integrates:
 *  - Clean Intent Extraction
 *  - Entity Resolution
 *  - Metric Resolution
 *  - GPT SQL Generation (v1/v2)
 *  - Full SQL Validation (2-pass rectify loop)
 *  - SQL Execution
 *  - Summary Generation
 ********************************************************************************************/

/********************************************************************************************
 * PART 4/4 — FULL HTTP HANDLER (CORS-PATCHED VERSION)
 * - Ensures ALL return paths include proper CORS headers
 * - Adds jsonResponse() helper
 ********************************************************************************************/

// ...existing code...

// 🔧 Helper – Always include CORS
function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  // 🔥 Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    /**************************************************************************
     * Parse request
     **************************************************************************/
    const body = await req.json();
    const { userQuery, sessionId, chatHistory } = body as QueryRequest;

    /**************************************************************************
     * Prepare Supabase client
     **************************************************************************/
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );

/**************************************************************************
 * AUTH PATCH — TOKEN-BASED ACCESS, FULLY CORS SAFE
 **************************************************************************/

// Allow browser preflight through without auth
if (req.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}

// Grab Authorization header
const authHeader = req.headers.get("Authorization");

// Reject if missing or not Bearer
if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
  return jsonResponse(
    { error: "Missing Authorization Bearer token" },
    401
  );
}

// Extract token
const accessToken = authHeader.substring(7).trim();

// Validate token using Supabase GoTrue
const {
  data: userData,
  error: userError,
} = await supabaseClient.auth.getUser(accessToken);

if (userError || !userData?.user) {
  return jsonResponse(
    { error: "Invalid or expired token" },
    401
  );
}

// ✔ Auth successful
const authedUser = userData.user;


    /**************************************************************************
     * Load schema definitions
     **************************************************************************/
    const { data: schemas, error: schemasError } =
      await supabaseClient.from("schemas").select("*");

    if (schemasError) {
      console.warn("Could not load schemas:", schemasError);
    }

    /**************************************************************************
     * Entity master
     **************************************************************************/
    const entityMaster = await loadEntityMaster(supabaseClient);
    const entityDict = buildEntityDictionary(entityMaster);

    /**************************************************************************
     * Business context and metrics
     **************************************************************************/
    const {
      rawMarkdown: businessContextMarkdown,
      metrics: metricsFromDoc,
    } = await loadBusinessContext(supabaseClient);

    /**************************************************************************
     * Table metadata loading
     **************************************************************************/
    const tablesInfo = await Promise.all(
      (schemas || []).map(async (schema: any) => {
        const { data: sanitizedName } = await supabaseClient.rpc(
          "sanitize_table_name",
          { p_name: schema.name }
        );
        if (!sanitizedName) return null;

        const tableName = `clean_${sanitizedName}`;

        try {
          const { data: columns } = await supabaseClient.rpc(
            "get_table_columns",
            { p_table_name: tableName }
          );
          if (!columns) return null;

          const { data: samples } = await supabaseClient
            .from(tableName)
            .select("*")
            .limit(5);

          return {
            schemaName: schema.name,
            schemaDescription: schema.description,
            tableName,
            columns: columns.map((c: any) => ({
              name: c.column_name,
              type: c.data_type,
            })),
            sampleRows: samples || [],
          };
        } catch (e) {
          console.warn(`Error inspecting table ${schema.name}`, e);
          return null;
        }
      })
    );

    let validTables = (tablesInfo || []).filter(Boolean);

    /**************************************************************************
     * Version 2 — Load normalized view metadata
     **************************************************************************/
    if (SQL_ENGINE_VERSION === "v2") {
      const { data: normCols, error: normErr } = await supabaseClient.rpc(
        "get_table_columns",
        { p_table_name: "hotel_monthly_normalized" }
      );

      if (!normErr && normCols) {
        const { data: sampleRows } = await supabaseClient
          .from("hotel_monthly_normalized")
          .select("*")
          .limit(5);

        validTables.push({
          schemaName: "normalized",
          schemaDescription: "Monthly normalized view",
          tableName: "hotel_monthly_normalized",
          columns: normCols.map((c: any) => ({
            name: c.column_name,
            type: c.data_type,
          })),
          sampleRows: sampleRows || [],
        });
      }
    }

    if (validTables.length === 0) {
      return jsonResponse(
        { error: "No valid tables found for SQL generation." },
        500
      );
    }

    const tableSchemasForValidation = validTables.map((t: any) => ({
      tableName: t.tableName,
      columns: t.columns,
    }));

    const schemaSummary = validTables
      .map(
        (t: any) =>
          `Table: ${t.tableName}\nColumns: ${t.columns
            .map((c: any) => c.name)
            .join(", ")}`
      )
      .join("\n");

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return jsonResponse(
        { error: "OPENAI_API_KEY is missing in Edge Function environment." },
        500
      );
    }

    /**************************************************************************
     * STAGE 0 — Enriched Query (AI-driven)
     **************************************************************************/
    const enrichedQuery: EnrichedQuery = await enrichQuery(
      openaiApiKey,
      businessContextMarkdown,
      schemaSummary,
      userQuery,
      chatHistory
    );

    /**************************************************************************
     * ENTITY RESOLUTION
     **************************************************************************/
    // Use enrichedQuery fields directly for SQL generation and downstream logic
    // STAGE 1 — Query Classification (optional, can use enrichedQuery.additional_instructions)
    // STAGE 2 — SQL Generation (v1/v2)
    const { sql: generatedSql, explanation } = await generateSQLWithVersion(
      openaiApiKey,
      validTables,
      businessContextMarkdown,
      enrichedQuery // pass enrichedQuery instead of cleanIntent
    );

    // STAGE 3 — Validation Pipeline (syntax + semantic + rectify)
    const { validatedSql, attempts } = await validateAndRectifySQL(
      openaiApiKey,
      generatedSql,
      enrichedQuery,
      tableSchemasForValidation
    );

    // STAGE 4 — Execute Validated SQL
    const { data: queryData, error: queryError } = await supabaseClient.rpc(
      "execute_safe_query",
      { query_text: validatedSql }
    );

    if (queryError) {
      return jsonResponse(
        { error: `SQL Execution Error: ${queryError.message}` },
        500
      );
    }

    let queryResult = Array.isArray(queryData)
      ? queryData
      : queryData
      ? [queryData]
      : [];

    // Fix percentages: scale only if value is between -1 and 1 (fractional), preserve sign
    queryResult = queryResult.map((row: any) => {
      if (
        row.metric_type === "percentage" &&
        typeof row.metric_value === "number" &&
        Math.abs(row.metric_value) <= 1
      ) {
        row.metric_value = row.metric_value * 100;
      }
      return row;
    });

    // STAGE 5 — Summary Generation
    const summaryPrompt = `
Summarize the following query result in JSON:

Clean Query: ${escapeForPrompt(userQuery)}
Rows: ${escapeForPrompt(JSON.stringify(queryResult.slice(0, 40)))}

Return:
{
  "short_answer": "...",
  "detailed_explanation": "..."
}
`;

    const sumResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [
          { role: "system", content: "Return JSON only." },
          { role: "user", content: summaryPrompt },
        ],
        max_tokens: 600,
      }),
    });

    const sumData = await sumResp.json();
    let sumRaw = sumData.choices?.[0]?.message?.content || "";
    sumRaw = sumRaw.replace(/```json/g, "").replace(/```/g, "").trim();

    let summary = "";
    try {
      const m = sumRaw.match(/\{[\s\S]*\}/);
      summary = m ? JSON.parse(m[0]).short_answer : "";
    } catch {
      summary = "";
    }

    // Persist into chat_messages
    await supabaseClient.from("chat_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: summary,
      sql_query: validatedSql,
      query_result: queryResult,
      metadata: {
        originalQuery: userQuery,
        enrichedQuery,
        validationAttempts: attempts,
        version: SQL_ENGINE_VERSION,
      },
    });

    // Final Response (CORS-safe)
    return jsonResponse({
      needsClarification: false,
      sql: validatedSql,
      explanation,
      summary,
      results: queryResult,
      version: SQL_ENGINE_VERSION,
    });
  } catch (err: any) {
    console.error("ERROR:", err);
    return jsonResponse({ error: err.message || String(err) }, 500);
  }
});
