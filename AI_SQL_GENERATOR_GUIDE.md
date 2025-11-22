# AI SQL Generator - Technical Guide

## Overview

The AI SQL Generator is a sophisticated multi-stage system that converts natural language queries into executable SQL, handles complex data transformations, and provides intelligent output formatting. It's designed specifically for business analytics and cross-user data sharing.

## Architecture Flow

```
User Query → Query Preprocessing → Classification → SQL Generation → Execution → Data Processing → Response
```

## Stage-by-Stage Process

### 1. Query Preprocessing & Output Format Specification

**Purpose**: Clean the user query and define the exact output structure expected by business users.

**Input**: Raw natural language query
**Output**: Cleaned query + Output format specification

#### Example Query Processing:
```
Original: "what is the month on month growth for revenue of Marriott over last 6 months vs that of orr"

Cleaned Query: "Compare month-over-month revenue growth for Marriott vs ORR hotels over the last 6 months"

Output Format Specification:
{
  "columns": [
    {"name": "month", "sourceColumn": "month", "derived": false},
    {"name": "Marriott revenue", "sourceColumn": "revenue", "derived": false},
    {"name": "ORR revenue", "sourceColumn": "revenue", "derived": false},
    {"name": "Marriott MoM Growth", "formula": "LAG(revenue) OVER (PARTITION BY hotel ORDER BY month)", "derived": true},
    {"name": "ORR MoM Growth", "formula": "LAG(revenue) OVER (PARTITION BY hotel ORDER BY month)", "derived": true}
  ],
  "pivot": true,
  "pivotEntities": ["Marriott", "ORR"],
  "sort": [{"column": "month", "direction": "asc"}]
}
```

**Key Features**:
- **Comparison Detection**: Identifies multi-entity comparisons using keywords (vs, versus, compare, between)
- **Entity Extraction**: Extracts specific entities mentioned (Marriott, ORR)
- **Derived Metrics**: Automatically identifies when calculations are needed (month-over-month growth)
- **Column Ordering**: Defines exact output column order for business presentation

### 2. Query Classification

**Purpose**: Determine if the query is clear enough to proceed or needs clarification.

**Process**:
```typescript
const classificationPrompt = `
Available schemas: ${schemas}
Business Context: ${businessContext}
Query: "${cleanQuery}"

Respond with: { "status": "clear" | "needs_clarification", "confidence": 0.0-1.0, "questions": ["..."] }
`;
```

**Decision Logic**:
- `status: "clear"` → Proceed to SQL generation
- `status: "needs_clarification"` → Ask follow-up questions

### 3. SQL Generation with Output Format Enforcement

**Purpose**: Generate PostgreSQL that exactly matches the specified output format.

#### Key SQL Generation Rules:

1. **Column Order Enforcement**: SELECT columns must match `outputFormat.columns[]` order exactly
2. **Pivot Logic**: When `pivot: true`, generate CASE WHEN expressions for entity-specific columns
3. **Derived Metrics**: Implement formulas using exact SQL expressions
4. **Sorting**: Apply ORDER BY to match `outputFormat.sort`

#### Example SQL for Marriott vs ORR Query:

**Input Data Structure** (Non-pivoted):
```sql
SELECT * FROM clean_hotel_revenue_data LIMIT 3;
-- month       | hotel_name | revenue
-- 2024-01-01  | Marriott   | 50000
-- 2024-01-01  | ORR        | 45000
-- 2024-02-01  | Marriott   | 52000
```

**Generated SQL** (Pivoted with MoM Growth):
```sql
SELECT 
  month,
  SUM(CASE WHEN hotel_name = 'Marriott' THEN revenue ELSE 0 END) AS "Marriott revenue",
  SUM(CASE WHEN hotel_name = 'ORR' THEN revenue ELSE 0 END) AS "ORR revenue",
  ROUND(
    (SUM(CASE WHEN hotel_name = 'Marriott' THEN revenue ELSE 0 END) - 
     LAG(SUM(CASE WHEN hotel_name = 'Marriott' THEN revenue ELSE 0 END)) 
     OVER (ORDER BY month)) * 100.0 / 
    NULLIF(LAG(SUM(CASE WHEN hotel_name = 'Marriott' THEN revenue ELSE 0 END)) 
           OVER (ORDER BY month), 0), 2
  ) AS "Marriott MoM Growth %",
  ROUND(
    (SUM(CASE WHEN hotel_name = 'ORR' THEN revenue ELSE 0 END) - 
     LAG(SUM(CASE WHEN hotel_name = 'ORR' THEN revenue ELSE 0 END)) 
     OVER (ORDER BY month)) * 100.0 / 
    NULLIF(LAG(SUM(CASE WHEN hotel_name = 'ORR' THEN revenue ELSE 0 END)) 
           OVER (ORDER BY month), 0), 2
  ) AS "ORR MoM Growth %"
FROM clean_hotel_revenue_data
WHERE hotel_name IN ('Marriott', 'ORR')
  AND month >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY month
ORDER BY month
```

### 4. Safe SQL Execution

**Security Layer**: `execute_safe_query()` function ensures only SELECT queries are executed.

**Validation**:
- Query must start with SELECT
- No dangerous keywords (DELETE, INSERT, UPDATE, DROP, etc.)
- Automatic error handling and result formatting

```typescript
const { data, error } = await supabaseClient
  .rpc('execute_safe_query', { query_text: sanitizedSql });
```

### 5. Automatic Data Transformation

**Pivot Detection & Enforcement**: The system automatically detects when data needs pivoting and applies it.

#### When Pivoting Occurs:
- **Input**: Non-pivoted data (entity column + category column + metrics)
- **Output**: Pivoted data (category column + entity-specific metric columns)

```typescript
function pivotData(data, entityCol, categoryCol, metricCols, desiredColumnOrder) {
  // Groups by category (e.g., month)
  // Creates entity-specific columns (e.g., "Marriott revenue", "ORR revenue")
  // Enforces exact column ordering from outputFormat
}
```

**Example Transformation**:
```javascript
// Input (Non-pivoted)
[
  { month: '2024-01', hotel_name: 'Marriott', revenue: 50000 },
  { month: '2024-01', hotel_name: 'ORR', revenue: 45000 },
  { month: '2024-02', hotel_name: 'Marriott', revenue: 52000 }
]

// Output (Pivoted)
[
  { month: '2024-01', 'Marriott revenue': 50000, 'ORR revenue': 45000, 'Marriott MoM Growth %': null, 'ORR MoM Growth %': null },
  { month: '2024-02', 'Marriott revenue': 52000, 'ORR revenue': 48000, 'Marriott MoM Growth %': 4.0, 'ORR MoM Growth %': 6.67 }
]
```

### 6. Data Summary Generation

**Purpose**: Create natural language explanation of the results.

```typescript
const summaryPrompt = `
Query: ${sanitizedSql}
Results: ${queryResults.slice(0, 10)}

Provide a conversational summary (1-2 sentences).
`;
```

**Example Summary**:
> "Marriott showed consistent revenue growth with 4% month-over-month increase in February, while ORR achieved higher growth at 6.67% in the same period. Both hotels demonstrated positive performance trends over the analyzed 6-month period."

## Cross-User Data Sharing

### Row Level Security (RLS) Configuration

The system implements a **hybrid security model**:

#### Private Data (User-Specific):
- `chat_sessions` - User's conversation history
- `chat_messages` - Individual chat messages

#### Shared Business Data (Global Read Access):
- `schemas` - Database schema definitions
- `business_context` - Business context information  
- `mappings` - Data field mappings
- `clean_data` - Processed dataset metadata
- `clean_*` tables - Actual cleaned datasets

#### RLS Policy Structure:
```sql
-- Example: Global read access for schemas
CREATE POLICY "All authenticated users can view schemas"
ON schemas FOR SELECT
TO authenticated
USING (true);

-- User-specific write access
CREATE POLICY "Users can create schemas"
ON schemas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### Function Permissions

All RPC functions are accessible to authenticated users:
- `sanitize_table_name()` - Converts schema names to safe table names
- `get_table_columns()` - Retrieves table structure for SQL generation
- `execute_safe_query()` - Safely executes SELECT-only queries

## Complex Query Examples

### 1. Revenue Comparison with Growth Metrics

**Query**: "Compare quarterly revenue growth between Marriott and Hilton properties, show percentage change"

**Processing**:
- **Entities Detected**: Marriott, Hilton
- **Time Period**: Quarterly
- **Metrics**: Revenue, Growth percentage
- **Comparison**: True (vs/between detected)

**Generated Output Format**:
```json
{
  "columns": [
    {"name": "quarter", "sourceColumn": "quarter"},
    {"name": "Marriott Revenue", "sourceColumn": "revenue"},
    {"name": "Hilton Revenue", "sourceColumn": "revenue"},
    {"name": "Marriott Growth %", "derived": true, "formula": "percentage_change"},
    {"name": "Hilton Growth %", "derived": true, "formula": "percentage_change"}
  ],
  "pivot": true,
  "pivotEntities": ["Marriott", "Hilton"]
}
```

### 2. Multi-Metric Analysis

**Query**: "Show occupancy rate, average daily rate, and RevPAR for all properties by month"

**Processing**:
- **Entities**: All properties (no specific filter)
- **Metrics**: Occupancy rate, ADR, RevPAR
- **Time Period**: Monthly
- **Comparison**: False (aggregate view)

**Output Format**:
```json
{
  "columns": [
    {"name": "month", "sourceColumn": "month"},
    {"name": "property_name", "sourceColumn": "property_name"},
    {"name": "occupancy_rate", "sourceColumn": "occupancy_rate"},
    {"name": "average_daily_rate", "sourceColumn": "adr"},
    {"name": "RevPAR", "derived": true, "formula": "occupancy_rate * adr / 100"}
  ],
  "pivot": false
}
```

### 3. Trend Analysis with Forecasting

**Query**: "What's the trend in customer satisfaction scores for luxury properties over the past year?"

**Processing**:
- **Filter**: Luxury properties only
- **Metric**: Customer satisfaction scores
- **Time Range**: Past year
- **Analysis**: Trend identification

## Error Handling & Debugging

### Common Issues & Solutions

1. **RPC Function Parameter Mismatch**:
   ```typescript
   // ❌ Wrong
   .rpc('get_table_columns', { p_table_name: tableName })
   
   // ✅ Correct  
   .rpc('get_table_columns', { table_name: tableName })
   ```

2. **RLS Policy Conflicts**:
   ```sql
   -- Check current policies
   SELECT tablename, policyname, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

3. **Output Format Validation**:
   - Ensure column names match SQL aliases exactly
   - Verify pivot entities exist in actual data
   - Check derived formulas for SQL syntax

### Diagnostic Tools

1. **`DIAGNOSTIC_CROSS_USER_ACCESS.sql`** - Tests cross-user permissions
2. **`AI_ORCHESTRATOR_DEBUG.sql`** - Step-by-step function testing
3. **`CHECK_RLS_STATUS.sql`** - RLS policy validation

## Performance Considerations

### Query Optimization

1. **Index Usage**: Ensure proper indexes on time and entity columns
2. **Data Limiting**: Automatic LIMIT clauses for large datasets
3. **Aggregation Efficiency**: Use GROUP BY strategically for pivot operations

### Caching Strategy

1. **Schema Caching**: Table structures cached between requests
2. **Business Context**: Markdown context cached in Supabase Storage
3. **Function Results**: RPC function results cached when possible

## Integration Points

### Frontend Integration

```typescript
// Example API call
const response = await fetch('/supabase/functions/ai-sql-orchestrator', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userQuery: "Compare Marriott vs ORR revenue growth",
    sessionId: "session_123",
    chatHistory: previousMessages
  })
});

const result = await response.json();
// result.sql - Generated SQL
// result.results - Query results
// result.outputFormat - Exact format specification
// result.dataSummary - Natural language summary
```

### Chart Generation Integration

The `outputFormat` provides structured data that can be directly consumed by charting libraries:

```typescript
// Use outputFormat for chart configuration
const chartConfig = {
  type: result.outputFormat.pivot ? 'line' : 'bar',
  data: result.results,
  xAxis: result.outputFormat.columns[0].name, // First column (usually time)
  yAxes: result.outputFormat.columns.slice(1).map(col => col.name)
};
```

This comprehensive system ensures that business users can ask complex analytical questions in natural language and receive accurate, well-formatted results that can be immediately used for decision-making and visualization.