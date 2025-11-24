# Currency Formatting in AI Chat Responses

## Overview

This guide documents the implementation of intelligent currency formatting in AI chat query results. The system now displays currency symbols (INR, USD, etc.) for currency-related metrics based on the `reporting_currency` field from the database schema.

## Implementation Details

### 1. Backend: AI SQL Orchestrator

**File**: `supabase/functions/ai-sql-orchestrator/index.ts`

**Changes**:
- Updated the `CanonicalRow` interface to include an optional `reporting_currency` field
- Modified the SQL generation prompt to instruct the AI to include `reporting_currency` in the SELECT statement when available in the source table
- The orchestrator now returns currency codes (e.g., 'USD', 'INR') alongside metric values

**Example Output**:
```typescript
interface CanonicalRow {
  period: string;
  period_grain: 'month' | 'quarter' | 'half_year' | 'year';
  entity_name: string;
  metric_name: string;
  metric_label: string;
  metric_type: 'absolute' | 'percentage';
  metric_value: number;
  reporting_currency?: string; // e.g., 'USD', 'INR'
}
```

### 2. Frontend: Canonical Data Table

**File**: `src/components/query-results/CanonicalDataTable.tsx`

**Changes**:
- Updated `CanonicalRow` interface to include `reporting_currency` field
- Modified `formatValue()` function to accept and use the currency parameter
- Updated the pivoted data rendering to pass `reporting_currency` from data rows

**Currency Detection Logic**:
```typescript
const formatValue = (value: number, metricType: string, metricName: string, currency?: string) => {
  if (metricType === 'percentage') {
    return formatPercentage(value);
  }
  
  // Detect currency fields by metric name
  const lowerMetricName = metricName.toLowerCase();
  if (lowerMetricName.includes('revenue') || 
      lowerMetricName.includes('price') || 
      lowerMetricName.includes('cost') ||
      lowerMetricName.includes('adr')) {
    return formatCurrency(value, currency || 'USD'); // Use provided currency or default to USD
  }
  
  return formatNumber(value);
};
```

### 3. Frontend: Canonical Chart Renderer

**File**: `src/components/charts/CanonicalChartRenderer.tsx`

**Changes**:
- Updated `CanonicalRow` interface to include `reporting_currency` field
- Modified data pivoting to preserve currency information alongside metric values
- Added `getCurrencyForSeries()` helper function to retrieve currency for a specific series
- Updated `formatAxisValue()` to accept and use currency parameter
- Enhanced Y-axis formatting to use currency from the first series on that axis

**Currency Preservation in Pivoted Data**:
```typescript
// Store both the metric value and its currency
const key = row.entity_name ? `${row.entity_name}_${row.metric_name}` : row.metric_name;
newRow[key] = row.metric_value;
if (row.reporting_currency) {
  newRow[`${key}_currency`] = row.reporting_currency; // Store currency separately
}
```

## How It Works

### Data Flow

1. **Database**: Clean data tables have a `reporting_currency` column (e.g., 'USD', 'INR')
2. **AI SQL Orchestrator**: Generates SQL that selects `reporting_currency` if available
3. **Query Execution**: Returns canonical format data with currency codes
4. **Frontend Display**: 
   - Table view: Uses currency from each row to format values
   - Chart view: Preserves currency in pivoted data and applies it to axes and tooltips

### Currency Application Rules

1. **Metric Type Check**: Currency formatting is only applied to metrics identified as currency-related
2. **Name-Based Detection**: Metrics containing keywords like "revenue", "price", "cost", "adr" are treated as currency
3. **Schema-Based Currency**: The actual currency symbol (INR/USD) comes from the `reporting_currency` field
4. **Fallback**: If no `reporting_currency` is provided, defaults to 'USD'

## Examples

### Before (Without Currency Support)
```
Total Revenue: 1,234,567.00
Average Daily Rate: 5,432.10
```

### After (With Currency Support)
```
Total Revenue: ₹1,234,567  (when reporting_currency = 'INR')
Average Daily Rate: $5,432  (when reporting_currency = 'USD')
```

## Schema Requirements

For currency formatting to work properly, your clean data tables should include:

1. **reporting_currency column**: TEXT field containing ISO currency codes ('USD', 'INR', 'EUR', etc.)
2. **Currency field type**: Schema fields marked as `type: 'currency'` in the schema definition

Example schema field:
```typescript
{
  id: 'total_revenue',
  name: 'total_revenue',
  displayLabel: 'Total Revenue',
  type: 'currency',  // Marks this as a currency field
  description: 'Total revenue for the period',
  required: true
}
```

## Testing

To test currency formatting:

1. Ensure your clean data table has a `reporting_currency` column
2. Populate it with currency codes ('USD', 'INR', etc.)
3. Ask the AI for revenue or other financial metrics
4. Verify that:
   - Table view shows correct currency symbols
   - Charts display currency symbols on axes and tooltips
   - Different entities can have different currencies if needed

## Supported Currencies

The implementation supports all currencies available in the JavaScript `Intl.NumberFormat` API, including:

- USD (United States Dollar) - $
- INR (Indian Rupee) - ₹
- EUR (Euro) - €
- GBP (British Pound) - £
- JPY (Japanese Yen) - ¥
- And many more...

## Future Enhancements

Potential improvements:

1. **Currency Conversion**: Convert all values to a single currency for comparison
2. **Multi-Currency Charts**: Handle charts with multiple currencies more explicitly
3. **Currency Preferences**: User-configurable default currency
4. **Exchange Rate Integration**: Real-time currency conversion using exchange rates

## Related Files

- `src/lib/formatters.ts` - Core formatting functions
- `src/types/excel.ts` - Schema and field type definitions
- `CANONICAL_DATA_MIGRATION_GUIDE.md` - Overall canonical data format guide
- `NUMBER_FORMATTING_GUIDE.md` - General number formatting documentation
