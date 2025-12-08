// queryEnricher.ts
// AI-driven enrichment of raw user query into a detailed structured object for SQL generation

export interface EnrichedQuery {
  entities: string[];
  period: {
    grain: "month" | "quarter" | "half_year" | "year";
    start: string | null;
    end: string | null;
  };
  metrics: string[];
  joins: string[];
  group_by: string[];
  where: string[];
  additional_instructions: string;
}

export async function enrichQuery(
  openaiKey: string,
  businessContext: string,
  schemaSummary: string,
  userQuery: string,
  chatHistory: Array<{ role: string; content: string }>
): Promise<EnrichedQuery> {
  const prompt = `
You are an expert in financial data warehousing for hospitality. Given the business context, schema, and a raw user query, generate a JSON object that fully specifies the enriched query intent for SQL generation.

BUSINESS CONTEXT:
${businessContext}

SCHEMA SUMMARY:
${schemaSummary}

CHAT HISTORY:
${chatHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}

RAW USER QUERY:
"${userQuery}"

Output JSON:
{
  "entities": ["..."], // canonical names
  "period": {
    "grain": "month|quarter|half_year|year",
    "start": "...",
    "end": "..."
  },
  "metrics": ["..."], // canonical metric names
  "joins": ["..."], // explicit join instructions
  "group_by": ["..."], // fields to group by
  "where": ["..."], // filters
  "additional_instructions": "..."
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
        { role: "system", content: "You are a query enrichment expert. Always output valid JSON." },
        { role: "user", content: prompt },
      ],
      max_tokens: 1200,
      temperature: 0.1,
    }),
  });

  const data = await resp.json();
  let raw = data.choices?.[0]?.message?.content ?? "";
  raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Enriched Query JSON not found");

  return JSON.parse(m[0]);
}
