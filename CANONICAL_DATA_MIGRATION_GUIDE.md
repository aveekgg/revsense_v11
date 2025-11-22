# Canonical Long-Format Data Migration Guide

## Overview

The SQL orchestrator and chart generator have been updated to use a **canonical long-format** data structure that eliminates pivot complexity and provides stable, reusable chart configurations.

## What Changed

### 1. SQL Orchestrator Output (`ai-sql-orchestrator`)

**Old Format (Pivoted):**
```json
{
  "sql": "SELECT ...",
  "results": [
    {
      "month": "2025-05-01",
      "JW Marriott Pune total_revenue": 177604,
      "JW Marriott Pune fnb_pct_of_total": 25.3,
      "ORR Hotel total_revenue": 4052213,
      "ORR Hotel fnb_pct_of_total": 22.2
    }
  ],
  "outputFormat": { "pivot": true, "columns": [...] }
}
```

**New Format (Canonical Long):**
```json
{
  "sql": "SELECT ...",
  "results": [
    {
      "period": "2025-05-01",
      "period_grain": "month",
      "entity_name": "JW Marriott Pune",
      "metric_name": "total_revenue",
      "metric_label": "Total Revenue",
      "metric_type": "absolute",
      "metric_value": 177604
    },
    {
      "period": "2025-05-01",
      "period_grain": "month",
      "entity_name": "JW Marriott Pune",
      "metric_name": "fnb_share_of_total",
      "metric_label": "F&B % of Total Revenue",
      "metric_type": "percentage",
      "metric_value": 25.3
    },
    {
      "period": "2025-05-01",
      "period_grain": "month",
      "entity_name": "ORR Hotel",
      "metric_name": "total_revenue",
      "metric_label": "Total Revenue",
      "metric_type": "absolute",
      "metric_value": 4052213
    },
    {
      "period": "2025-05-01",
      "period_grain": "month",
      "entity_name": "ORR Hotel",
      "metric_name": "fnb_share_of_total",
      "metric_label": "F&B % of Total Revenue",
      "metric_type": "percentage",
      "metric_value": 22.2
    }
  ],
  "outputFormat": null
}
```

### 2. Chart Generator Output (`ai-chart-generator`)

**Old Format:**
```json
{
  "chartType": "combo",
  "config": {
    "xAxis": "month",
    "series": [
      {
        "dataKey": "JW Marriott Pune total_revenue",
        "type": "bar",
        "yAxisId": "left"
      }
    ]
  }
}
```

**New Format:**
```json
{
  "config": {
    "chartType": "combo",
    "xKey": "period",
    "timeGrain": "month",
    "xTimeFormat": "MMM-yy",
    "title": "Revenue and F&B % - JW Marriott vs ORR",
    "yAxes": [
      {
        "id": "left",
        "label": "Revenue",
        "type": "absolute",
        "format": "currency",
        "decimals": 0
      },
      {
        "id": "right",
        "label": "F&B % of Total",
        "type": "percentage",
        "format": "percentage",
        "decimals": 1
      }
    ],
    "series": [
      {
        "id": "jw_marriott_total_revenue",
        "type": "bar",
        "metric_name": "total_revenue",
        "entity_name": "JW Marriott Pune",
        "yAxisId": "left",
        "color": "hsl(var(--chart-1))",
        "label": "JW Marriott Revenue"
      },
      {
        "id": "orr_total_revenue",
        "type": "bar",
        "metric_name": "total_revenue",
        "entity_name": "ORR Hotel",
        "yAxisId": "left",
        "color": "hsl(var(--chart-2))",
        "label": "ORR Revenue"
      },
      {
        "id": "jw_marriott_fnb_pct",
        "type": "line",
        "metric_name": "fnb_share_of_total",
        "entity_name": "JW Marriott Pune",
        "yAxisId": "right",
        "color": "#ff7300",
        "label": "JW Marriott F&B %"
      },
      {
        "id": "orr_fnb_pct",
        "type": "line",
        "metric_name": "fnb_share_of_total",
        "entity_name": "ORR Hotel",
        "yAxisId": "right",
        "color": "hsl(var(--chart-3))",
        "label": "ORR F&B %"
      }
    ],
    "showLegend": true,
    "showTooltip": true
  },
  "data": [
    // Canonical long-format rows (sorted by period)
  ]
}
```

## Benefits

### 1. No Column Explosion
- **Old**: 3 metrics × 4 entities × 7 months = **12 columns** (entity × metric combinations)
- **New**: **7 fixed columns** regardless of entities/metrics/time points

### 2. Stable Configuration
- Chart config is decoupled from data rows
- Can save config and reuse with updated data
- Adding new time periods doesn't change config
- Adding new entities just requires adding series (optional)

### 3. Proper Time Formatting
- **Month**: `MMM-yy` → `May-25`, `Jun-25`
- **Quarter**: `Q-yy` → `Q1-25`, `Q2-25`
- **Half Year**: `half-yy` → `H1-25`, `H2-25`
- **Year**: `yyyy` → `2025`, `2026`

### 4. Percentage Handling
- All percentages stored in **0–100 range** (not 0–1)
- Consistent formatting across SQL and charts

### 5. Proper Sorting
- Data sorted chronologically by `period` ascending
- No manual date parsing needed in frontend

## Frontend Migration Required

### Option 1: Quick Compatibility Adapter (Recommended for Testing)

Add a helper function to pivot canonical data back to wide format for the existing `ChartRenderer`:

```typescript
// src/lib/chartDataAdapter.ts
interface CanonicalRow {
  period: string;
  period_grain: 'month' | 'quarter' | 'half_year' | 'year';
  entity_name: string;
  metric_name: string;
  metric_label: string;
  metric_type: 'absolute' | 'percentage';
  metric_value: number;
}

export function pivotCanonicalData(data: CanonicalRow[]): any[] {
  const grouped = new Map<string, any>();

  data.forEach(row => {
    if (!grouped.has(row.period)) {
      grouped.set(row.period, { period: row.period });
    }
    const periodRow = grouped.get(row.period)!;
    
    // Create column name: "Entity metric_name"
    const columnKey = `${row.entity_name} ${row.metric_name}`;
    periodRow[columnKey] = row.metric_value;
  });

  return Array.from(grouped.values());
}

export function adaptChartConfig(newConfig: any): { chartType: string; config: any } {
  const { config, data } = newConfig;
  
  // If new format, pivot data and convert series
  if (config && config.series && data) {
    const pivotedData = pivotCanonicalData(data);
    
    const adaptedSeries = config.series.map((s: any) => ({
      dataKey: s.entity_name 
        ? `${s.entity_name} ${s.metric_name}`
        : s.metric_name,
      type: s.type,
      name: s.label || s.dataKey,
      yAxisId: s.yAxisId,
      color: s.color
    }));

    return {
      chartType: config.chartType,
      config: {
        xAxis: config.xKey,
        series: adaptedSeries,
        format: {
          type: config.yAxes?.[0]?.format || 'number',
          decimals: config.yAxes?.[0]?.decimals || 2
        }
      }
    };
  }

  // Old format, return as-is
  return newConfig;
}
```

Update `ChatMessage.tsx`:

```tsx
import { adaptChartConfig, pivotCanonicalData } from '@/lib/chartDataAdapter';

// In handleGenerateChart:
const response = await supabase.functions.invoke('ai-chart-generator', {
  body: {
    queryResult,
    cleanedQuery: metadata?.cleanedQuery || content,
    sqlQuery
  }
});

if (response.error) throw response.error;

// Adapt new format to old format
const adapted = adaptChartConfig(response.data);
const adaptedData = response.data.data 
  ? pivotCanonicalData(response.data.data)
  : queryResult;

setGeneratedChart(adapted);
setAdaptedChartData(adaptedData); // Store pivoted data separately
```

Then in render:

```tsx
{showChart && generatedChart && (
  <div className="mb-3">
    <ChartRenderer 
      type={generatedChart.chartType} 
      data={adaptedChartData || queryResult} 
      config={generatedChart.config}
    />
  </div>
)}
```

### Option 2: Update ChartRenderer (Long-term Solution)

Create a new `CanonicalChartRenderer` that works directly with canonical data:

```tsx
// src/components/charts/CanonicalChartRenderer.tsx
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CanonicalRow {
  period: string;
  period_grain: 'month' | 'quarter' | 'half_year' | 'year';
  entity_name: string;
  metric_name: string;
  metric_label: string;
  metric_type: 'absolute' | 'percentage';
  metric_value: number;
}

interface ChartConfig {
  chartType: 'line' | 'bar' | 'combo' | 'area';
  xKey: 'period';
  timeGrain: 'month' | 'quarter' | 'half_year' | 'year';
  xTimeFormat: 'MMM-yy' | 'Q-yy' | 'half-yy' | 'yyyy';
  title?: string;
  yAxes: Array<{
    id: 'left' | 'right';
    label?: string;
    type: 'absolute' | 'percentage';
    format?: 'currency' | 'number' | 'percentage';
    decimals?: number;
  }>;
  series: Array<{
    id: string;
    type: 'line' | 'bar' | 'area';
    metric_name: string;
    entity_name?: string;
    yAxisId: 'left' | 'right';
    color: string;
    label?: string;
  }>;
  showLegend: boolean;
  showTooltip: boolean;
}

export function CanonicalChartRenderer({ 
  config, 
  data 
}: { 
  config: ChartConfig; 
  data: CanonicalRow[] 
}) {
  // Format period labels based on grain
  const formatPeriodLabel = (period: string): string => {
    const date = new Date(period);
    
    switch (config.xTimeFormat) {
      case 'MMM-yy':
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      case 'Q-yy':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter}-${date.getFullYear().toString().slice(-2)}`;
      case 'half-yy':
        const half = date.getMonth() < 6 ? 'H1' : 'H2';
        return `${half}-${date.getFullYear().toString().slice(-2)}`;
      case 'yyyy':
        return date.getFullYear().toString();
      default:
        return period;
    }
  };

  // Pivot data for Recharts (group by period, spread metrics)
  const pivotedData = data.reduce((acc, row) => {
    const existing = acc.find(r => r.period === row.period);
    const key = row.entity_name 
      ? `${row.entity_name}_${row.metric_name}`
      : row.metric_name;
    
    if (existing) {
      existing[key] = row.metric_value;
    } else {
      acc.push({
        period: row.period,
        periodLabel: formatPeriodLabel(row.period),
        [key]: row.metric_value
      });
    }
    return acc;
  }, [] as any[]);

  const hasRightAxis = config.yAxes.some(ax => ax.id === 'right');

  return (
    <ResponsiveContainer width="100%" height={450}>
      <ComposedChart data={pivotedData} margin={{ top: 20, right: 30, bottom: 60, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="periodLabel"
          className="text-xs"
          stroke="hsl(var(--muted-foreground))"
          angle={-45}
          textAnchor="end"
          height={80}
        />
        
        {config.yAxes.map(axis => (
          <YAxis
            key={axis.id}
            yAxisId={axis.id}
            orientation={axis.id === 'right' ? 'right' : 'left'}
            label={{ value: axis.label, angle: -90, position: 'insideLeft' }}
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(value) => {
              if (axis.format === 'currency') return `$${value.toLocaleString()}`;
              if (axis.format === 'percentage') return `${value.toFixed(axis.decimals || 1)}%`;
              return value.toLocaleString();
            }}
          />
        ))}

        {config.showTooltip && (
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
        )}
        {config.showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}

        {config.series.map(s => {
          const dataKey = s.entity_name 
            ? `${s.entity_name}_${s.metric_name}`
            : s.metric_name;
          
          const props = {
            key: s.id,
            dataKey,
            name: s.label,
            yAxisId: s.yAxisId,
            stroke: s.color,
            fill: s.color
          };

          if (s.type === 'bar') return <Bar {...props} />;
          if (s.type === 'line') return <Line {...props} type="monotone" strokeWidth={2} />;
          if (s.type === 'area') return <Area {...props} type="monotone" />;
          return null;
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

## Testing the New Flow

### Test Query Example

```
"What was the revenue of Marriott vs ORR and % of total revenue F&B is over last 7 months"
```

### Expected SQL Output Structure

```sql
-- Canonical long-format output
SELECT
  period,
  'month'::text AS period_grain,
  entity_name,
  metric_name,
  metric_label,
  metric_type,
  metric_value
FROM (
  -- UNION ALL of multiple metrics
  SELECT
    date_trunc('month', date_col)::date AS period,
    hotel_name AS entity_name,
    'total_revenue'::text AS metric_name,
    'Total Revenue'::text AS metric_label,
    'absolute'::text AS metric_type,
    SUM(total_revenue)::numeric AS metric_value
  FROM clean_hotel_data
  WHERE hotel_name IN ('JW Marriott Pune', 'ORR Hotel')
    AND date_col >= date_trunc('month', current_date) - interval '6 months'
  GROUP BY period, entity_name

  UNION ALL

  SELECT
    date_trunc('month', date_col)::date AS period,
    hotel_name AS entity_name,
    'fnb_share_of_total'::text AS metric_name,
    'F&B % of Total Revenue'::text AS metric_label,
    'percentage'::text AS metric_type,
    (SUM(fnb_revenue)::numeric / NULLIF(SUM(total_revenue), 0)) * 100 AS metric_value
  FROM clean_hotel_data
  WHERE hotel_name IN ('JW Marriott Pune', 'ORR Hotel')
    AND date_col >= date_trunc('month', current_date) - interval '6 months'
  GROUP BY period, entity_name
) metrics
ORDER BY period ASC, entity_name ASC, metric_name ASC;
```

### Verification Checklist

- [ ] SQL returns canonical long format (7 columns fixed)
- [ ] Percentages are in 0–100 range
- [ ] Data is sorted by period ascending
- [ ] Chart config has stable series definitions
- [ ] Time labels formatted correctly (MMM-yy for months)
- [ ] Dual axes for absolute + percentage metrics
- [ ] Colors assigned consistently
- [ ] Legend shows all series with proper labels

## Deployment Status

✅ `ai-sql-orchestrator` - Deployed (canonical long-format output)
✅ `ai-chart-generator` - Deployed (stable config schema)
⏳ Frontend adapters - Needs implementation (use Option 1 for quick testing)

## Next Steps

1. **Test in UI**: Run a multi-entity, multi-metric query in the chat interface
2. **Verify SQL output**: Check browser DevTools Network tab for canonical format
3. **Verify chart config**: Check that config has proper `yAxes`, `series`, `timeGrain`
4. **Implement adapter**: Add `chartDataAdapter.ts` and update `ChatMessage.tsx`
5. **Test chart rendering**: Verify charts display correctly with adapted data
6. **Optional**: Create `CanonicalChartRenderer` for long-term solution

## Troubleshooting

### Charts not rendering
- Check if `response.data` has `{ config, data }` structure
- Verify adapter is pivoting data correctly
- Check `series[].dataKey` matches pivoted column names

### Wrong time labels
- Check `period_grain` in SQL output
- Verify `xTimeFormat` in chart config
- Ensure date formatting logic matches grain

### Percentages showing wrong
- Check SQL multiplies by 100 for percentage metrics
- Verify `metric_type === 'percentage'` in output
- Check axis format is set to 'percentage'

### Missing entities/metrics
- Verify `entities` and `metrics` arrays in clean intent
- Check SQL UNION ALL includes all metrics
- Verify series config includes all (entity, metric) combos
