import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { EnhancedDataTable } from '@/components/query-results/EnhancedDataTable';
import { formatNumber, formatCurrency, formatPercentage } from '@/lib/formatters';

interface SeriesConfig {
  dataKey: string;
  type: 'bar' | 'line' | 'area';
  yAxisId?: 'left' | 'right';
  name?: string;
  color?: string;
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
    format?: {
      type?: 'currency' | 'percentage' | 'number';
      decimals?: number;
    };
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

  // Smart format values for charts based on field names
  const formatChartValue = (value: any, fieldName?: string) => {
    if (value === null || value === undefined) return value;
    
    // Use field name from context if available, otherwise use format config
    if (fieldName && typeof fieldName === 'string') {
      // Use our smart formatters
      const lowerName = fieldName.toLowerCase();
      
      if (lowerName.includes('percent') || lowerName.includes('rate') || 
          lowerName.includes('ratio') || lowerName.includes('occupancy')) {
        return formatPercentage(value);
      }
      
      if (lowerName.includes('revenue') || lowerName.includes('amount') || 
          lowerName.includes('price') || lowerName.includes('cost') ||
          lowerName.includes('total') || lowerName.includes('adr')) {
        return formatCurrency(value);
      }
      
      return formatNumber(value, fieldName);
    }
    
    // Fallback to config-based formatting
    const num = Number(value);
    if (isNaN(num)) return value;
    
    if (format?.type === 'currency') {
      return formatCurrency(value);
    }
    if (format?.type === 'percentage') {
      return formatPercentage(value);
    }
    if (format?.type === 'number') {
      return formatNumber(value);
    }
    
    return formatNumber(value);
  };

  // Combo chart with multiple series and dual Y-axes
  if (type === 'combo' && series && series.length > 0) {
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
            tickFormatter={(value) => formatChartValue(value)}
          />
          {hasRightAxis && (
            <YAxis 
              yAxisId="right"
              orientation="right"
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(value) => formatChartValue(value)}
            />
          )}
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={formatChartValue}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {validSeries.map((s, idx) => {
            const seriesProps = {
              key: idx,
              dataKey: s.dataKey,
              name: s.name || s.dataKey,
              yAxisId: s.yAxisId || 'left',
              fill: s.color || COLORS[idx % COLORS.length],
              stroke: s.color || COLORS[idx % COLORS.length],
            };

            if (s.type === 'bar') {
              return <Bar {...seriesProps} />;
            }
            if (s.type === 'line') {
              return <Line {...seriesProps} type="monotone" strokeWidth={2} />;
            }
            if (s.type === 'area') {
              return <Area {...seriesProps} type="monotone" />;
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
            tickFormatter={(value) => formatChartValue(value)}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={formatChartValue}
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
            tickFormatter={(value) => formatChartValue(value)}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={formatChartValue}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line 
            type="monotone" 
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
            tickFormatter={(value) => formatChartValue(value)}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={formatChartValue}
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
            formatter={formatChartValue}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
};
