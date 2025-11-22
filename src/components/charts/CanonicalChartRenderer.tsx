import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatNumber, formatCurrency, formatPercentage } from '@/lib/formatters';

// Canonical long-form data row from ai-sql-orchestrator
export interface CanonicalRow {
  period: string;        // e.g. "2025-05-01", first day of month/quarter/half/year
  period_grain: 'month' | 'quarter' | 'half_year' | 'year';
  entity_name: string;   // hotel/property/asset name
  metric_name: string;   // semantic key, e.g. total_revenue, fnb_share_of_total
  metric_label: string;  // human label
  metric_type: 'absolute' | 'percentage';
  metric_value: number;  // percentages already 0-100
  [key: string]: any;    // allow extra dimensions if needed
}

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

interface CanonicalChartRendererProps {
  config: ChartConfig;
  data: CanonicalRow[];
}

export function CanonicalChartRenderer({ config, data }: CanonicalChartRendererProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data to display
      </div>
    );
  }

  // Format period labels based on grain
  const formatPeriodLabel = (period: string): string => {
    const date = new Date(period);
    
    switch (config.xTimeFormat) {
      case 'MMM-yy':
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      case 'Q-yy': {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter}-${date.getFullYear().toString().slice(-2)}`;
      }
      case 'half-yy': {
        const half = date.getMonth() < 6 ? 'H1' : 'H2';
        return `${half}-${date.getFullYear().toString().slice(-2)}`;
      }
      case 'yyyy':
        return date.getFullYear().toString();
      default:
        return period;
    }
  };

  // Pivot canonical data for Recharts (group by period, spread metrics as columns)
  const pivotedData = data.reduce((acc, row) => {
    const existing = acc.find(r => r.period === row.period);
    
    // Create unique key for this series (entity + metric)
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

  // Sort by period to ensure chronological order
  pivotedData.sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime());

  const hasRightAxis = config.yAxes.some(ax => ax.id === 'right');

  // Format axis values based on axis config
  const formatAxisValue = (value: number, axis: AxisConfig): string => {
    if (axis.format === 'currency') {
      return formatCurrency(value);
    }
    if (axis.format === 'percentage') {
      return `${value.toFixed(axis.decimals ?? 1)}%`;
    }
    return formatNumber(value);
  };

  // Format tooltip values based on series type
  const formatTooltipValue = (value: number, seriesId: string): string => {
    const series = config.series.find(s => {
      const key = s.entity_name 
        ? `${s.entity_name}_${s.metric_name}`
        : s.metric_name;
      return key === seriesId;
    });

    if (!series) return formatNumber(value);

    const axis = config.yAxes.find(ax => ax.id === series.yAxisId);
    if (!axis) return formatNumber(value);

    return formatAxisValue(value, axis);
  };

  return (
    <div className="w-full">
      {config.title && (
        <h3 className="text-lg font-semibold mb-2 px-4">{config.title}</h3>
      )}
      {config.description && (
        <p className="text-sm text-muted-foreground mb-4 px-4">{config.description}</p>
      )}
      
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
            label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -10 } : undefined}
          />
          
          {config.yAxes.map(axis => (
            <YAxis
              key={axis.id}
              yAxisId={axis.id}
              orientation={axis.id === 'right' ? 'right' : 'left'}
              label={axis.label ? { 
                value: axis.label, 
                angle: -90, 
                position: axis.id === 'right' ? 'insideRight' : 'insideLeft',
                style: { textAnchor: 'middle' }
              } : undefined}
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(value) => formatAxisValue(value, axis)}
            />
          ))}

          {config.showTooltip && (
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                color: 'hsl(var(--popover-foreground))'
              }}
              formatter={(value: any, name: string) => [
                formatTooltipValue(value, name),
                config.series.find(s => {
                  const key = s.entity_name 
                    ? `${s.entity_name}_${s.metric_name}`
                    : s.metric_name;
                  return key === name;
                })?.label || name
              ]}
              labelFormatter={(label) => `Period: ${label}`}
            />
          )}
          
          {config.showLegend && (
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => {
                const series = config.series.find(s => {
                  const key = s.entity_name 
                    ? `${s.entity_name}_${s.metric_name}`
                    : s.metric_name;
                  return key === value;
                });
                return series?.label || value;
              }}
            />
          )}

          {config.series.map(s => {
            const dataKey = s.entity_name 
              ? `${s.entity_name}_${s.metric_name}`
              : s.metric_name;
            
            const props = {
              key: s.id,
              dataKey,
              name: dataKey, // Used for tooltip/legend lookup
              yAxisId: s.yAxisId,
              stroke: s.color,
              fill: s.color
            };

            if (s.type === 'bar') {
              return <Bar {...props} />;
            }
            if (s.type === 'line') {
              return <Line {...props} type="monotone" strokeWidth={2} dot={{ r: 3 }} />;
            }
            if (s.type === 'area') {
              return <Area {...props} type="monotone" />;
            }
            return null;
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
