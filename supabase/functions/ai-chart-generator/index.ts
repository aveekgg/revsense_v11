import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Canonical long-form data row from ai-sql-orchestrator
// One row per (period, entity, metric)
interface CanonicalRow {
  period: string;        // e.g. "2025-05-01", first day of month/quarter/half/year
  period_grain: 'month' | 'quarter' | 'half_year' | 'year';
  entity_name: string;   // hotel/property/asset name
  metric_name: string;   // semantic key, e.g. total_revenue, fnb_share_of_total
  metric_label: string;  // human label
  metric_type: 'absolute' | 'percentage';
  metric_value: number;  // percentages already 0-100
  [key: string]: any;    // allow extra dimensions if needed
}

interface ChartGeneratorRequest {
  queryResult: CanonicalRow[];
  cleanedQuery: string;
  sqlQuery: string;
}

// Stable chart configuration schema, decoupled from data
export type TimeGrain = 'month' | 'quarter' | 'half_year' | 'year';
export type ChartType = 'line' | 'bar' | 'combo' | 'area';

export interface AxisConfig {
  id: 'left' | 'right';
  label?: string;
  type: 'absolute' | 'percentage';
  format?: 'currency' | 'number' | 'percentage';
  decimals?: number;
}

export interface SeriesConfig {
  id: string;              // unique
  type: 'line' | 'bar' | 'area';
  metric_name: string;     // link to CanonicalRow.metric_name
  entity_name?: string;    // optional: restrict series to one entity
  yAxisId: 'left' | 'right';
  color: string;
  label?: string;          // legend label
}

export interface ChartConfig {
  chartType: ChartType;
  xKey: 'period';
  timeGrain: TimeGrain;
  xTimeFormat: 'MMM-yy' | 'Q-yy' | 'half-yy' | 'yyyy';
  title?: string;
  description?: string;
  xLabel?: string;
  yAxes: AxisConfig[];
  series: SeriesConfig[];
  showLegend: boolean;
  showTooltip: boolean;
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
    console.log('AI Chart Generator function invoked (canonical long format)');
    const body = await req.json();
    const { queryResult, cleanedQuery, sqlQuery }: ChartGeneratorRequest = body;

    if (!queryResult || !Array.isArray(queryResult) || queryResult.length === 0) {
      throw new Error('Invalid or empty query result');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable not configured');
    }

    // Defensive copy and basic numeric rounding
    const cleanData = (data: CanonicalRow[]): CanonicalRow[] => {
      return data.map(row => {
        const cleaned: any = { ...row };
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === 'number') {
            cleaned[key] = Math.round(value * 100) / 100;
          }
        }
        return cleaned as CanonicalRow;
      });
    };

    let processedData: CanonicalRow[] = cleanData(queryResult);

    // === PHASE 1: Canonical analysis (no pivoting) ===
    // Sort chronologically by period
    processedData = [...processedData].sort(
      (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
    );

    const timeGrain: TimeGrain = processedData[0].period_grain ?? 'month';

    const uniqueMetricsMap = new Map<string, { metric_name: string; metric_label: string; metric_type: 'absolute' | 'percentage' }>();
    const uniqueEntities = new Set<string>();

    for (const row of processedData) {
      uniqueMetricsMap.set(row.metric_name, {
        metric_name: row.metric_name,
        metric_label: row.metric_label,
        metric_type: row.metric_type,
      });
      uniqueEntities.add(row.entity_name);
    }

    const metrics = Array.from(uniqueMetricsMap.values());
    const entities = Array.from(uniqueEntities.values());

    const absoluteMetrics = metrics.filter(m => m.metric_type === 'absolute');
    const percentageMetrics = metrics.filter(m => m.metric_type === 'percentage');

    console.log('📊 Metrics detected:', JSON.stringify(metrics));
    console.log('🏨 Entities detected:', JSON.stringify(entities));
    console.log('⏱  Time grain:', timeGrain);
    console.log('🔢 Sample data (first 20 rows):', JSON.stringify(processedData.slice(0, 20)));

    // === PHASE 2: Build AI prompt for ChartConfig ===
    const structuralSummary = {
      metrics,
      entities,
      timeGrain,
      rowCount: processedData.length,
    };

    const chartGenerationPrompt = `You are a data visualization expert specializing in Recharts.js.

The data is in a canonical LONG FORMAT, one row per (period, entity, metric):

interface CanonicalRow {
  period: string;        // e.g. "2025-05-01", first day of period
  period_grain: 'month' | 'quarter' | 'half_year' | 'year';
  entity_name: string;   // hotel/property/asset name
  metric_name: string;   // semantic key
  metric_label: string;  // human label
  metric_type: 'absolute' | 'percentage';
  metric_value: number;  // percentages are already 0-100
}

USER QUERY: "${escapeForPrompt(cleanedQuery)}"
SQL QUERY: ${escapeForPrompt(sqlQuery)}

STRUCTURAL SUMMARY:
${JSON.stringify(structuralSummary, null, 2)}

SAMPLE ROWS (first 20):
${JSON.stringify(processedData.slice(0, 20), null, 2)}

Your job is to choose an appropriate chart type and generate a robust ChartConfig that is decoupled from the data array.

ChartConfig TypeScript interface:

export type TimeGrain = 'month' | 'quarter' | 'half_year' | 'year';
export type ChartType = 'line' | 'bar' | 'combo' | 'area';

export interface AxisConfig {
  id: 'left' | 'right';
  label?: string;
  type: 'absolute' | 'percentage';
  format?: 'currency' | 'number' | 'percentage';
  decimals?: number;
  scale?: 'auto' | 'thousands' | 'lakhs' | 'millions' | 'crores';
}

export interface SeriesConfig {
  id: string;              // unique
  type: 'line' | 'bar' | 'area';
  metric_name: string;     // link to CanonicalRow.metric_name
  entity_name?: string;    // optional: restrict to one entity
  yAxisId: 'left' | 'right';
  color: string;
  label?: string;          // legend label
  lineType?: 'monotone' | 'linear' | 'step';  // line interpolation type
}

export interface ChartConfig {
  chartType: ChartType;
  xKey: 'period';
  timeGrain: TimeGrain;
  xTimeFormat: 'MMM-yy' | 'Q-yy' | 'half-yy' | 'yyyy';
  title?: string;
  description?: string;
  xLabel?: string;
  yAxes: AxisConfig[];
  series: SeriesConfig[];
  showLegend: boolean;
  showTooltip: boolean;
}

RULES:
1) Always set xKey = 'period'. The frontend will format labels based on xTimeFormat.
2) Choose timeGrain from the data (period_grain) and set xTimeFormat as:
   - month     -> 'MMM-yy'  (e.g. May-25)
   - quarter   -> 'Q-yy'    (e.g. Q1-25)
   - half_year -> 'half-yy' (e.g. H1-25 / H2-25)
   - year      -> 'yyyy'    (e.g. 2025)
3) Chart type guidelines:
   - If you see 1 metric and 1 entity over time -> LineChart (chartType = 'line').
   - If 1 metric and multiple entities -> multi-entity comparison -> bar or combo with multiple bar series.
   - If multiple metrics and 1 entity -> multi-line or combo chart showing each metric separately.
   - If multiple metrics and multiple entities -> combo chart with bars for absolute metrics and lines for percentages.
4) Axes:
   - If there is at least one percentage metric AND one absolute metric:
     * Use two axes: left for absolute, right for percentage.
   - If only absolute metrics: single left axis (type='absolute').
   - If only percentages: single right axis (type='percentage').
   - Set format accordingly: 'currency' for revenue-like metrics (you can infer from metric_name/label), 'percentage' for percentage metrics, 'number' otherwise.
   - INTELLIGENT SCALING: For large absolute values, add 'scale' property:
     * If max value >= 10,000,000 (10M): scale = 'millions' 
     * If max value >= 1,000,000 (1M): scale = 'millions'
     * If max value >= 100,000 (1 lakh): scale = 'lakhs'
     * If max value >= 10,000: scale = 'thousands'
     * Otherwise: scale = 'auto'
5) Series mapping:
   - Each unique (metric_name, entity_name) combination that is relevant should become a SeriesConfig.
   - For multi-entity comparison on the same metric, use multiple series with same metric_name but different entity_name.
   - ENHANCED COLOR ASSIGNMENT: Distribute colors more intelligently:
     * For 1-5 series: use chart-1 through chart-5 sequentially: 
       - "hsl(var(--chart-1))" (Primary Blue)
       - "hsl(var(--chart-2))" (Secondary Purple) 
       - "hsl(var(--chart-3))" (Teal)
       - "hsl(var(--chart-4))" (Amber)
       - "hsl(var(--chart-5))" (Rose)
     * For 6+ series: cycle through colors with better contrast
     * Group related metrics with similar color families when possible
     * NEVER use solid colors like "black", "blue", etc. - always use hsl(var(--chart-N)) format
   - For line charts, set lineType = 'linear' for straight lines (not curved)
   - Use lines for percentage metrics in a combo chart when mixed with absolute bars.
6) Sorting & stability:
   - Assume the backend already sorted data by period ascending.
   - The config must NOT depend on row count, only on metric/entity/timeGrain structure.
7) Title/description:
   - Generate a concise, business-friendly title from the metrics, entities, and time window implied by the data.
   - Optionally include a short description.

EXAMPLE COLOR USAGE:
{
  "series": [
    {
      "id": "hotel_a_revenue",
      "type": "bar", 
      "color": "hsl(var(--chart-1))",
      "metric_name": "total_revenue",
      "entity_name": "Hotel A",
      "yAxisId": "left"
    },
    {
      "id": "hotel_b_revenue", 
      "type": "bar",
      "color": "hsl(var(--chart-2))",
      "metric_name": "total_revenue", 
      "entity_name": "Hotel B",
      "yAxisId": "left"
    }
  ]
}

Return ONLY valid JSON matching ChartConfig. Do NOT include any markdown or commentary.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a data visualization expert. Analyze the canonical long-format data and generate an optimal Recharts ChartConfig. Always respond with valid JSON.'
          },
          { role: 'user', content: chartGenerationPrompt }
        ],
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      }),
    });

    const data = await response.json();
    console.log('Chart generation response:', JSON.stringify(data));

    if (!data.choices?.[0]?.message?.content) {
      throw new Error(`Chart generation failed: ${JSON.stringify(data)}`);
    }

    const chartConfig: ChartConfig = JSON.parse(data.choices[0].message.content);
    console.log('Generated chart config:', JSON.stringify(chartConfig));

    // Final response: return both config and data so frontend can render and reuse config
    return new Response(
      JSON.stringify({
        config: chartConfig,
        data: processedData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-chart-generator:', error);
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
