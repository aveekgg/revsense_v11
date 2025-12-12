import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { EnhancedDataTable } from '@/components/query-results/EnhancedDataTable';
import { formatNumber, formatCurrency, formatPercentage } from '@/lib/formatters';

interface SeriesConfig {
  dataKey: string;
  type: 'bar' | 'line' | 'area';
  yAxisId?: 'left' | 'right';
  name?: string;
  color?: string;
  stackId?: string;
  strokeDasharray?: string;  // For dashed lines (e.g., "5 5")
  showDataLabels?: boolean;  // Per-series data labels toggle
  labelPosition?: 'top' | 'center' | 'bottom';  // Position of data labels
}

interface ChartRendererProps {
  type: 'bar' | 'line' | 'pie' | 'area' | 'table' | 'combo';
  data: any[];
  config?: {
    xAxis?: string;
    yAxis?: string;
    dataKey?: string;
    title?: string;
    colors?: string[];
    series?: SeriesConfig[];
    yAxes?: Array<{
      id: 'left' | 'right';
      label?: string;
      min?: number;
      max?: number;
      scale?: string;
      sciExponent?: number;
      format?: 'currency' | 'number' | 'percentage';
      decimals?: number;
    }>;
    format?: {
      type?: 'currency' | 'percentage' | 'number';
      decimals?: number;
    };
    showOriginalValues?: boolean;
    showLegend?: boolean;
    showTooltip?: boolean;
  };
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const ChartRenderer = ({ type, data, config = {} }: ChartRendererProps) => {
  // Validate data structure
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data to display
      </div>
    );
  }

  if (!Array.isArray(data)) {
    console.error('ChartRenderer: data must be an array, got:', typeof data);
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        Invalid data format - expected array
      </div>
    );
  }

  if (type === 'table') {
    return <EnhancedDataTable data={data} maxHeight={600} />;
  }

  const { xAxis, yAxis, dataKey, series, format } = config;

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

  // Convert number to Unicode superscript
  const toSuperscript = (num: number): string => {
    const superscriptDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    return num.toString().split('').map(digit => superscriptDigits[parseInt(digit)]).join('');
  };

  // Utility function to get scale suffix for display
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

  // Smart format values for charts based on field names
  const formatChartValue = (value: any, fieldName?: string, axisConfig?: { scale?: string; sciExponent?: number; format?: string; decimals?: number }, currency?: string) => {
    if (value === null || value === undefined) return value;
    
    // Apply scaling if axis config is provided
    let scaledValue = value;
    if (axisConfig?.scale && axisConfig.scale !== 'auto') {
      scaledValue = scaleValue(value, axisConfig.scale, axisConfig.sciExponent);
    }
    
    // If we have axis config with format/decimals, use axis formatting over smart formatters
    if (axisConfig?.format) {
      const num = Number(scaledValue);
      if (isNaN(num)) return value;
      
      if (axisConfig.format === 'currency') {
        const formatted = formatCurrency(num);
        return axisConfig?.scale === 'sci_custom' ? formatted : (getScaleSuffix(axisConfig?.scale, axisConfig?.sciExponent) ? `${formatted}${getScaleSuffix(axisConfig?.scale, axisConfig?.sciExponent)}` : formatted);
      }
      if (axisConfig.format === 'percentage') {
        const decimals = axisConfig?.decimals ?? 1;
        return `${num.toFixed(decimals)}%`;
      }
      if (axisConfig.format === 'number') {
        const decimals = axisConfig?.decimals ?? 2;
        const formatted = num.toLocaleString('en-US', {
          minimumFractionDigits: decimals > 0 ? 1 : 0,
          maximumFractionDigits: decimals,
        });
        return axisConfig?.scale === 'sci_custom' ? formatted : (getScaleSuffix(axisConfig?.scale, axisConfig?.sciExponent) ? `${formatted}${getScaleSuffix(axisConfig?.scale, axisConfig?.sciExponent)}` : formatted);
      }
    }
    
    // Use field name from context if available, otherwise use format config
    if (fieldName && typeof fieldName === 'string') {
      // Use our smart formatters
      const lowerName = fieldName.toLowerCase();
      
      if (lowerName.includes('percent') || lowerName.includes('rate') || 
          lowerName.includes('ratio') || lowerName.includes('occupancy')) {
        return formatPercentage(scaledValue);
      }
      
      if (lowerName.includes('revenue') || lowerName.includes('amount') || 
          lowerName.includes('price') || lowerName.includes('cost') ||
          lowerName.includes('total') || lowerName.includes('adr')) {
        return formatCurrency(scaledValue, currency || 'USD');
      }
      
      return formatNumber(scaledValue, fieldName);
    }
    
    // Fallback to axis-based formatting
    const num = Number(scaledValue);
    if (isNaN(num)) return value;
    
    // Default number formatting
    const decimals = axisConfig?.decimals ?? 2;
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: decimals > 0 ? 1 : 0,
      maximumFractionDigits: decimals,
    });
    return axisConfig?.scale === 'sci_custom' ? formatted : (getScaleSuffix(axisConfig?.scale, axisConfig?.sciExponent) ? `${formatted}${getScaleSuffix(axisConfig?.scale, axisConfig?.sciExponent)}` : formatted);
  };

  // Combo chart with multiple series and dual Y-axes
  if ((type === 'combo' || (series && series.length > 0)) && series && series.length > 0) {
    const hasRightAxis = series.some(s => s.yAxisId === 'right');
    
    // Validate series configuration
    const validSeries = series.filter(s => {
      const hasDataKey = !!s.dataKey;
      const dataKeyExists = data.some(row => s.dataKey in row);
      
      if (!hasDataKey) {
        console.warn('ChartRenderer: Series missing dataKey:', s);
        return false;
      }
      if (!dataKeyExists) {
        console.warn(`ChartRenderer: dataKey "${s.dataKey}" not found in data. Available keys:`, Object.keys(data[0]));
        return false;
      }
      return true;
    });

    if (validSeries.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-destructive">
          Chart configuration error: No valid series found
          <div className="text-xs text-muted-foreground mt-2">
            Available columns: {Object.keys(data[0]).join(', ')}
          </div>
        </div>
      );
    }
    
    return (
      <ResponsiveContainer width="100%" height={450}>
        <ComposedChart data={data} margin={{ top: 20, right: 30, bottom: 60, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey={xAxis || Object.keys(data[0])[0]} 
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            yAxisId="left"
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            label={config.yAxes?.find(axis => axis.id === 'left')?.label ? {
              value: config.yAxes?.find(axis => axis.id === 'left')?.label,
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle' }
            } : undefined}
            tickFormatter={(value) => formatChartValue(value, undefined, config.yAxes?.find(axis => axis.id === 'left'))}
            domain={
              (() => {
                const axis = config.yAxes?.find(axis => axis.id === 'left');
                if (!axis) return ['auto', 'auto'];
                
                const min = axis.min !== undefined ? scaleValue(axis.min, axis.scale, axis.sciExponent) : undefined;
                const max = axis.max !== undefined ? scaleValue(axis.max, axis.scale, axis.sciExponent) : undefined;
                
                if (min !== undefined && max !== undefined) return [min, max];
                if (min !== undefined) return [min, 'auto'];
                if (max !== undefined) return ['auto', max];
                return ['auto', 'auto'];
              })()
            }
          />
          {hasRightAxis && (
            <YAxis 
              yAxisId="right"
              orientation="right"
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
              label={config.yAxes?.find(axis => axis.id === 'right')?.label ? {
                value: config.yAxes?.find(axis => axis.id === 'right')?.label,
                angle: -90,
                position: 'insideRight',
                style: { textAnchor: 'middle' }
              } : undefined}
              tickFormatter={(value) => formatChartValue(value, undefined, config.yAxes?.find(axis => axis.id === 'right'))}
              domain={
                (() => {
                  const axis = config.yAxes?.find(axis => axis.id === 'right');
                  if (!axis) return ['auto', 'auto'];
                  
                  const min = axis.min !== undefined ? scaleValue(axis.min, axis.scale, axis.sciExponent) : undefined;
                  const max = axis.max !== undefined ? scaleValue(axis.max, axis.scale, axis.sciExponent) : undefined;
                  
                  if (min !== undefined && max !== undefined) return [min, max];
                  if (min !== undefined) return [min, 'auto'];
                  if (max !== undefined) return ['auto', max];
                  return ['auto', 'auto'];
                })()
              }
            />
          )}
          {config?.showTooltip !== false && (
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                color: 'hsl(var(--popover-foreground))'
              }}
              formatter={(value, name, props) => {
                const axis = config.yAxes?.find(axis => axis.id === (props.payload?.yAxisId || 'left'));
                const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                if (axis?.scale === 'sci_custom' && axis.sciExponent && !isNaN(numValue)) {
                  const scaledValue = scaleValue(numValue, axis.scale, axis.sciExponent);
                  const coefficient = format?.type === 'currency' 
                    ? formatCurrency(scaledValue)
                    : scaledValue.toLocaleString('en-US', { maximumFractionDigits: 2 });
                  return [`${coefficient} × 10${toSuperscript(axis.sciExponent)}`, typeof name === 'string' ? name : String(name)];
                }
                return [formatChartValue(value, typeof name === 'string' ? name : String(name), axis), typeof name === 'string' ? name : String(name)];
              }}
            />
          )}
          {config?.showLegend !== false && (
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => {
                const series = validSeries.find(s => s.name === value || s.dataKey === value);
                if (series) {
                  // Check if there are multiple Y-axes configured
                  const hasMultipleAxes = config.yAxes && config.yAxes.length > 1;
                  
                  if (hasMultipleAxes) {
                    const axisConfig = config.yAxes?.find(axis => axis.id === series.yAxisId);
                    const axisLabel = axisConfig?.id === 'right' ? ' (Right)' : axisConfig?.id === 'left' ? ' (Left)' : '';
                    return `${series.name || series.dataKey}${axisLabel}`;
                  } else {
                    // Single axis - just show the series name
                    return series.name || series.dataKey;
                  }
                }
                return value;
              }}
            />
          )}
          {validSeries.map((s, idx) => {
            const seriesProps = {
              key: idx,
              dataKey: s.dataKey,
              name: s.name || s.dataKey,
              yAxisId: s.yAxisId || 'left',
              fill: s.color || COLORS[idx % COLORS.length],
              stroke: s.color || COLORS[idx % COLORS.length],
              ...(s.strokeDasharray && { strokeDasharray: s.strokeDasharray }),
              ...(s.stackId && { stackId: s.stackId }),
            };

            if (s.type === 'bar') {
              return (
                <Bar {...seriesProps}>
                  {(s.showDataLabels === true) && (
                    <LabelList 
                      dataKey={s.dataKey} 
                      position={s.labelPosition === 'center' ? "center" : s.labelPosition === 'bottom' ? "bottom" : (s.stackId ? "center" : "top")} 
                      formatter={(value: any, entry: any) => {
                        const currency = entry?.reporting_currency || entry?.reported_currency;
                        const axisConfig = config.yAxes?.find(axis => axis.id === s.yAxisId);
                        return formatChartValue(value, s.dataKey, axisConfig, currency);
                      }}
                      style={{ 
                        fontSize: '12px', 
                        fill: s.stackId ? 'white' : s.color || COLORS[idx % COLORS.length],
                        fontWeight: s.stackId ? 'bold' : 'normal',
                        textShadow: s.stackId ? '1px 1px 2px rgba(0,0,0,0.7)' : 'none'
                      }}
                    />
                  )}
                </Bar>
              );
            }
            if (s.type === 'line') {
              return (
                <Line 
                  {...seriesProps} 
                  type="linear" 
                  strokeWidth={2}
                  dot={(s.showDataLabels === true) ? false : { r: 3, strokeWidth: 2, fill: s.color || COLORS[idx % COLORS.length] }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: s.color || COLORS[idx % COLORS.length] }}
                  label={(s.showDataLabels === true) ? { 
                    fill: s.color || COLORS[idx % COLORS.length], 
                    fontSize: 12, 
                    position: s.labelPosition === 'center' ? 'center' : s.labelPosition === 'bottom' ? 'bottom' : 'top',
                    formatter: (value: any, entry: any) => {
                      const currency = entry?.reporting_currency || entry?.reported_currency;
                      const axisConfig = config.yAxes?.find(axis => axis.id === s.yAxisId);
                      return formatChartValue(value, s.dataKey, axisConfig, currency);
                    }
                  } : undefined}
                />
              );
            }
            if (s.type === 'area') {
              return (
                <Area 
                  {...seriesProps} 
                  type="linear"
                  strokeWidth={2}
                  dot={(s.showDataLabels === true) ? false : { r: 3, strokeWidth: 2, fill: s.color || COLORS[idx % COLORS.length] }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: s.color || COLORS[idx % COLORS.length] }}
                  label={(s.showDataLabels === true) ? { 
                    fill: s.color || COLORS[idx % COLORS.length], 
                    fontSize: 12, 
                    position: s.labelPosition === 'center' ? 'center' : s.labelPosition === 'bottom' ? 'bottom' : 'top',
                    formatter: (value: any, entry: any) => {
                      const currency = entry?.reporting_currency || entry?.reported_currency;
                      const axisConfig = config.yAxes?.find(axis => axis.id === s.yAxisId);
                      return formatChartValue(value, s.dataKey, axisConfig, currency);
                    }
                  } : undefined}
                />
              );
            }
            return null;
          })}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bar') {
    // Auto-detect multiple numeric columns for multi-series support
    const firstKey = xAxis || Object.keys(data[0])[0];
    const numericColumns = Object.keys(data[0]).filter(key => 
      key !== firstKey && typeof data[0][key] === 'number'
    );
    
    // If yAxis is specified, only use that column; otherwise use all numeric columns
    const columnsToRender = yAxis ? [yAxis] : numericColumns;
    
    return (
      <ResponsiveContainer width="100%" height={450}>
        <BarChart data={data} margin={{ top: 20, right: 30, bottom: 60, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey={firstKey} 
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(value) => formatChartValue(value, undefined, config.yAxes?.find(axis => axis.id === 'left'))}
            domain={
              (() => {
                const axis = config.yAxes?.find(axis => axis.id === 'left');
                if (!axis) return ['auto', 'auto'];
                
                const min = axis.min !== undefined ? scaleValue(axis.min, axis.scale, axis.sciExponent) : undefined;
                const max = axis.max !== undefined ? scaleValue(axis.max, axis.scale, axis.sciExponent) : undefined;
                
                if (min !== undefined && max !== undefined) return [min, max];
                if (min !== undefined) return [min, 'auto'];
                if (max !== undefined) return ['auto', max];
                return ['auto', 'auto'];
              })()
            }
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value, name) => {
              const axis = config.yAxes?.find(axis => axis.id === 'left');
              const numValue = typeof value === 'number' ? value : parseFloat(String(value));
              if (axis?.scale === 'sci_custom' && axis.sciExponent && !isNaN(numValue)) {
                const scaledValue = scaleValue(numValue, axis.scale, axis.sciExponent);
                const coefficient = format?.type === 'currency' 
                  ? formatCurrency(scaledValue)
                  : scaledValue.toLocaleString('en-US', { maximumFractionDigits: 2 });
                return [`${coefficient} × 10${toSuperscript(axis.sciExponent)}`, typeof name === 'string' ? name : String(name)];
              }
              return [formatChartValue(value, typeof name === 'string' ? name : String(name), axis), typeof name === 'string' ? name : String(name)];
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {columnsToRender.map((column, idx) => (
            <Bar 
              key={column}
              dataKey={column} 
              fill={COLORS[idx % COLORS.length]}
              name={column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  
  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={450}>
        <LineChart data={data} margin={{ top: 20, right: 30, bottom: 60, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey={xAxis || Object.keys(data[0])[0]} 
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(value) => formatChartValue(value, undefined, config.yAxes?.find(axis => axis.id === 'left'))}
            domain={
              (() => {
                const axis = config.yAxes?.find(axis => axis.id === 'left');
                if (!axis) return ['auto', 'auto'];
                
                const min = axis.min !== undefined ? scaleValue(axis.min, axis.scale, axis.sciExponent) : undefined;
                const max = axis.max !== undefined ? scaleValue(axis.max, axis.scale, axis.sciExponent) : undefined;
                
                if (min !== undefined && max !== undefined) return [min, max];
                if (min !== undefined) return [min, 'auto'];
                if (max !== undefined) return ['auto', max];
                return ['auto', 'auto'];
              })()
            }
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value, name) => {
              const axis = config.yAxes?.find(axis => axis.id === 'left');
              const numValue = typeof value === 'number' ? value : parseFloat(String(value));
              if (axis?.scale === 'sci_custom' && axis.sciExponent && !isNaN(numValue)) {
                const scaledValue = scaleValue(numValue, axis.scale, axis.sciExponent);
                const coefficient = format?.type === 'currency' 
                  ? formatCurrency(scaledValue)
                  : scaledValue.toLocaleString('en-US', { maximumFractionDigits: 2 });
                return [`${coefficient} × 10${toSuperscript(axis.sciExponent)}`, typeof name === 'string' ? name : String(name)];
              }
              return [formatChartValue(value, typeof name === 'string' ? name : String(name), axis), typeof name === 'string' ? name : String(name)];
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line 
            type="linear" 
            dataKey={yAxis || Object.keys(data[0])[1]} 
            stroke={COLORS[0]}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  
  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={450}>
        <AreaChart data={data} margin={{ top: 20, right: 30, bottom: 60, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey={xAxis || Object.keys(data[0])[0]} 
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(value) => formatChartValue(value, undefined, config.yAxes?.find(axis => axis.id === 'left'))}
            domain={
              (() => {
                const axis = config.yAxes?.find(axis => axis.id === 'left');
                if (!axis) return ['auto', 'auto'];
                
                const min = axis.min !== undefined ? scaleValue(axis.min, axis.scale, axis.sciExponent) : undefined;
                const max = axis.max !== undefined ? scaleValue(axis.max, axis.scale, axis.sciExponent) : undefined;
                
                if (min !== undefined && max !== undefined) return [min, max];
                if (min !== undefined) return [min, 'auto'];
                if (max !== undefined) return ['auto', max];
                return ['auto', 'auto'];
              })()
            }
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value, name) => {
              const axis = config.yAxes?.find(axis => axis.id === 'left');
              const numValue = typeof value === 'number' ? value : parseFloat(String(value));
              if (axis?.scale === 'sci_custom' && axis.sciExponent && !isNaN(numValue)) {
                const scaledValue = scaleValue(numValue, axis.scale, axis.sciExponent);
                const coefficient = format?.type === 'currency' 
                  ? formatCurrency(scaledValue)
                  : scaledValue.toLocaleString('en-US', { maximumFractionDigits: 2 });
                return [`${coefficient} × 10${toSuperscript(axis.sciExponent)}`, typeof name === 'string' ? name : String(name)];
              }
              return [formatChartValue(value, typeof name === 'string' ? name : String(name), axis), typeof name === 'string' ? name : String(name)];
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area 
            type="monotone" 
            dataKey={yAxis || Object.keys(data[0])[1]} 
            fill={COLORS[0]}
            stroke={COLORS[0]}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  
  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey || yAxis || Object.keys(data[0])[1]}
            nameKey={xAxis || Object.keys(data[0])[0]}
            cx="50%"
            cy="50%"
            outerRadius={120}
            label
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value, name, props) => {
              const currency = props?.payload?.reporting_currency || props?.payload?.reported_currency;
              return [formatChartValue(value, typeof name === 'string' ? name : String(name), undefined, currency), typeof name === 'string' ? name : String(name)];
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
};
