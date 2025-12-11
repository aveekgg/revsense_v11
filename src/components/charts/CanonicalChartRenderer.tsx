import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
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
  reporting_currency?: string; // Currency code (e.g., 'USD', 'INR') for currency metrics
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
  scale?: 'auto' | 'thousands' | 'lakhs' | 'millions' | 'crores' | 'billion' | 'sci_custom';
  min?: number;
  max?: number;
  sciExponent?: number;
}

export interface SeriesConfig {
  id: string;              // unique
  type: 'line' | 'bar' | 'area';
  metric_name: string;     // link to CanonicalRow.metric_name
  entity_name?: string;    // optional: restrict series to one entity
  yAxisId: 'left' | 'right';
  color: string;
  label?: string;          // legend label
  lineType?: 'monotone' | 'linear' | 'step';  // line interpolation type
  stackId?: string;        // for stacking bars/areas
}

export interface ChartConfig {
  chartType: ChartType;
  xKey: string;
  timeGrain: TimeGrain;
  xTimeFormat: 'MMM-yy' | 'Q-yy' | 'half-yy' | 'yyyy';
  title?: string;
  description?: string;
  xLabel?: string;
  yAxes: AxisConfig[];
  series: SeriesConfig[];
  showLegend: boolean;
  showTooltip: boolean;
  showDataLabels?: boolean;
  showOriginalValues?: boolean;
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

  // Utility function to scale values based on axis configuration
  const scaleValue = (value: number, scale?: string, sciExponent?: number): number => {
    switch (scale) {
      case 'thousands':
        return value / 1000;
      case 'lakhs':
        return value / 100000;
      case 'millions':
        return value / 1000000;
      case 'crores':
        return value / 10000000;
      case 'billion':
        return value / 1000000000;
      case 'sci_custom':
        return sciExponent ? value / Math.pow(10, sciExponent) : value;
      default:
        return value;
    }
  };

  // Utility function to get scale suffix for axis labels
  // Convert number to Unicode superscript
  const toSuperscript = (num: number): string => {
    const superscriptDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    return num.toString().split('').map(digit => superscriptDigits[parseInt(digit)]).join('');
  };

  const getScaleSuffix = (scale?: string, sciExponent?: number): string => {
    switch (scale) {
      case 'thousands':
        return 'K';
      case 'lakhs':
        return 'L';
      case 'millions':
        return 'M';
      case 'crores':
        return 'Cr';
      case 'billion':
        return 'B';
      case 'sci_custom':
        return sciExponent ? `×10${toSuperscript(sciExponent)}` : '';
      default:
        return '';
    }
  };

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

  // Pivot canonical data for Recharts (group by xKey, spread metrics as columns)
  const pivotedData = data.reduce((acc, row) => {
    const xValue = row[config.xKey] || row.period;
    const existing = acc.find(r => r.xValue === xValue);
    
    // Create unique key for this series (entity + metric)
    const key = row.entity_name 
      ? `${row.entity_name}_${row.metric_name}`
      : row.metric_name;
    
    if (existing) {
      existing[key] = row.metric_value;
      // Preserve currency for this series
      if (row.reporting_currency) {
        existing[`${key}_currency`] = row.reporting_currency;
      }
    } else {
      const newRow: any = {
        period: row.period, // Keep for sorting
        xValue: xValue,
        periodLabel: config.xKey === 'period' ? formatPeriodLabel(row.period) : xValue,
        [key]: row.metric_value
      };
      // Preserve currency for this series
      if (row.reporting_currency) {
        newRow[`${key}_currency`] = row.reporting_currency;
      }
      acc.push(newRow);
    }
    return acc;
  }, [] as any[]);

  // Sort by period to ensure chronological order
  pivotedData.sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime());

  const hasRightAxis = config.yAxes.some(ax => ax.id === 'right');

  // Get currency for a given series from the data
  const getCurrencyForSeries = (seriesId: string): string | undefined => {
    // Check if any data point has currency for this series
    for (const row of pivotedData) {
      const currencyKey = `${seriesId}_currency`;
      if (row[currencyKey]) {
        return row[currencyKey];
      }
    }
    return undefined;
  };

  // Format axis values based on axis config
  const formatAxisValue = (value: number, axis: AxisConfig, currency?: string): string => {
    // Apply scaling first
    const scaledValue = scaleValue(value, axis.scale, axis.sciExponent);
    
    if (axis.format === 'currency') {
      const formatted = formatCurrency(scaledValue, currency || 'USD');
      // For scientific notation, don't add suffix here - it's in the axis label
      return axis.scale === 'sci_custom' ? formatted : (getScaleSuffix(axis.scale, axis.sciExponent) ? `${formatted}${getScaleSuffix(axis.scale, axis.sciExponent)}` : formatted);
    }
    if (axis.format === 'percentage') {
      return `${scaledValue.toFixed(axis.decimals ?? 1)}%`;
    }
    // For number format, use decimals setting
    const decimals = axis.decimals ?? 2;
    const formatted = scaledValue.toLocaleString('en-US', {
      minimumFractionDigits: decimals > 0 ? 1 : 0,
      maximumFractionDigits: decimals,
    });
    // For scientific notation, don't add suffix here - it's in the axis label
    return axis.scale === 'sci_custom' ? formatted : (getScaleSuffix(axis.scale, axis.sciExponent) ? `${formatted}${getScaleSuffix(axis.scale, axis.sciExponent)}` : formatted);
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

    const currency = getCurrencyForSeries(seriesId);
    
    // For tooltips, show both scaled and original values for clarity (if enabled)
    if (axis.scale && axis.scale !== 'auto') {
      let scaledFormatted = formatAxisValue(value, axis, currency);
      
      // For scientific notation, show as "X * 10^n" format
      if (axis.scale === 'sci_custom' && axis.sciExponent) {
        const scaledValue = scaleValue(value, axis.scale, axis.sciExponent);
        const coefficient = axis.format === 'currency' 
          ? formatCurrency(scaledValue, currency || 'USD')
          : scaledValue.toLocaleString('en-US', { maximumFractionDigits: axis.decimals ?? 2 });
        scaledFormatted = `${coefficient} × 10${toSuperscript(axis.sciExponent)}`;
      }
      
      if (config.showOriginalValues) {
        const originalFormatted = axis.format === 'currency' 
          ? formatCurrency(value, currency || 'USD')
          : formatNumber(value);
        return `${scaledFormatted} (${originalFormatted})`;
      }
      return scaledFormatted;
    }
    
    return formatAxisValue(value, axis, currency);
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
        <ComposedChart 
          data={pivotedData} 
          margin={{ top: 20, right: hasRightAxis ? 50 : 30, bottom: 80, left: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          
          <XAxis 
            dataKey="periodLabel"
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}  // Show all labels
            label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5 } : undefined}
          />
          
          {config.yAxes.map(axis => {
            // Get currency from the first series that uses this axis
            const seriesForAxis = config.series.find(s => s.yAxisId === axis.id);
            const axisSeriesKey = seriesForAxis 
              ? (seriesForAxis.entity_name 
                  ? `${seriesForAxis.entity_name}_${seriesForAxis.metric_name}`
                  : seriesForAxis.metric_name)
              : undefined;
            const axisCurrency = axisSeriesKey ? getCurrencyForSeries(axisSeriesKey) : undefined;
            
            // Enhanced axis label with scale suffix
            const axisLabel = axis.label ? 
              (axis.scale && axis.scale !== 'auto' 
                ? axis.scale === 'sci_custom' && axis.sciExponent
                  ? `${axis.label} × 10${toSuperscript(axis.sciExponent)}`
                  : `${axis.label} (${getScaleSuffix(axis.scale, axis.sciExponent)})`
                : axis.label)
              : undefined;
            
            return (
              <YAxis
                key={axis.id}
                yAxisId={axis.id}
                orientation={axis.id === 'right' ? 'right' : 'left'}
                width={axis.id === 'right' ? 80 : 80}
                label={axisLabel ? { 
                  value: axisLabel, 
                  angle: -90, 
                  position: axis.id === 'right' ? 'insideRight' : 'insideLeft',
                  style: { textAnchor: 'middle' }
                } : undefined}
                className="text-xs"
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(value) => formatAxisValue(value, axis, axisCurrency)}
                domain={
                  axis.min !== undefined && axis.max !== undefined
                    ? [axis.min, axis.max]
                    : axis.min !== undefined
                    ? [axis.min, 'auto']
                    : axis.max !== undefined
                    ? ['auto', axis.max]
                    : ['auto', 'auto']
                }
              />
            );
          })}

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
              wrapperStyle={{ paddingTop: '30px', paddingBottom: '10px' }}
              iconType="line"
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

          {/* Render bars first, then lines for proper layering */}
          {config.series
            .filter(s => s.type === 'bar')
            .map(s => {
              const dataKey = s.entity_name 
                ? `${s.entity_name}_${s.metric_name}`
                : s.metric_name;
              
              const props = {
                key: s.id,
                dataKey,
                name: dataKey, // Used for tooltip/legend lookup
                yAxisId: s.yAxisId,
                fill: s.color,
                stroke: s.color,
                strokeWidth: 0,
                ...(s.stackId && { stackId: s.stackId })
              };

              return (
                <Bar {...props}>
                  {config.showDataLabels && (
                    <LabelList 
                      dataKey={dataKey} 
                      position={s.stackId ? "center" : "top"} 
                      formatter={(value: number) => formatTooltipValue(value, dataKey)}
                      style={{ 
                        fontSize: '12px', 
                        fill: s.stackId ? 'white' : s.color,
                        fontWeight: s.stackId ? 'bold' : 'normal',
                        textShadow: s.stackId ? '1px 1px 2px rgba(0,0,0,0.7)' : 'none'
                      }}
                    />
                  )}
                </Bar>
              );
            })}
          
          {/* Render areas second */}
          {config.series
            .filter(s => s.type === 'area')
            .map(s => {
              const dataKey = s.entity_name 
                ? `${s.entity_name}_${s.metric_name}`
                : s.metric_name;
              
              const props = {
                key: s.id,
                dataKey,
                name: dataKey, // Used for tooltip/legend lookup
                yAxisId: s.yAxisId,
                stroke: s.color,
                fill: s.color,
                fillOpacity: 0.6,
                ...(s.stackId && { stackId: s.stackId })
              };

              return (
                <Area 
                  {...props} 
                  type={s.lineType || 'linear'}
                  label={config.showDataLabels ? { 
                    fill: s.color, 
                    fontSize: 12, 
                    formatter: (value: number) => formatTooltipValue(value, dataKey)
                  } : undefined}
                />
              );
            })}

          {/* Render lines last for top layering */}
          {config.series
            .filter(s => s.type === 'line')
            .map(s => {
              const dataKey = s.entity_name 
                ? `${s.entity_name}_${s.metric_name}`
                : s.metric_name;
              
              const props = {
                key: s.id,
                dataKey,
                name: dataKey, // Used for tooltip/legend lookup
                yAxisId: s.yAxisId,
                stroke: s.color,
                strokeWidth: 2,
                fill: 'none'  // Ensure lines don't have fill
              };

              return (
                <Line 
                  {...props} 
                  type={s.lineType || 'linear'}  // Use linear for straight lines, or monotone for curves
                  dot={config.showDataLabels ? false : { r: 3, strokeWidth: 2, fill: s.color }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: s.color }}
                  label={config.showDataLabels ? { 
                    fill: s.color, 
                    fontSize: 12, 
                    formatter: (value: number) => formatTooltipValue(value, dataKey)
                  } : undefined}
                />
              );
            })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
