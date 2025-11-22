import { EnhancedDataTable } from './EnhancedDataTable';
import { PivotedCanonicalTable } from './PivotedCanonicalTable';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/formatters';

export interface CanonicalRow {
  period: string;
  period_grain: 'month' | 'quarter' | 'half_year' | 'year';
  entity_name: string;
  metric_name: string;
  metric_label: string;
  metric_type: 'absolute' | 'percentage';
  metric_value: number;
  [key: string]: any;
}

interface CanonicalDataTableProps {
  data: CanonicalRow[];
  viewMode?: 'long' | 'pivot'; // Default to 'pivot' for better UX
}

export function CanonicalDataTable({ data, viewMode = 'pivot' }: CanonicalDataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No data to display
      </div>
    );
  }

  // If user wants raw long format, show it with context info
  if (viewMode === 'long') {
    const grain = data[0]?.period_grain || 'month';
    return (
      <div>
        <div className="flex items-center justify-between mb-2 px-2">
          <p className="text-xs text-muted-foreground">
            Showing {data.length} rows in canonical long format
          </p>
          <p className="text-xs text-muted-foreground">
            Time grain: {grain.replace('_', ' ')}
          </p>
        </div>
        <EnhancedDataTable data={data} maxHeight={600} />
      </div>
    );
  }

  // Format period labels based on grain
  const formatPeriodLabel = (period: string, grain: string): string => {
    const date = new Date(period);
    
    switch (grain) {
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      case 'quarter': {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter}-${date.getFullYear().toString().slice(-2)}`;
      }
      case 'half_year': {
        const half = date.getMonth() < 6 ? 'H1' : 'H2';
        return `${half}-${date.getFullYear().toString().slice(-2)}`;
      }
      case 'year':
        return date.getFullYear().toString();
      default:
        return period;
    }
  };

  // Format value based on metric type
  const formatValue = (value: number, metricType: string, metricName: string): string | number => {
    if (metricType === 'percentage') {
      return formatPercentage(value);
    }
    
    // Check if metric name suggests it's currency
    const lowerMetricName = metricName.toLowerCase();
    if (lowerMetricName.includes('revenue') || 
        lowerMetricName.includes('price') || 
        lowerMetricName.includes('cost') ||
        lowerMetricName.includes('adr')) {
      return formatCurrency(value);
    }
    
    return formatNumber(value);
  };

  // Pivot the data: group by period, create columns for each entity × metric combination
  const periods = Array.from(new Set(data.map(r => r.period))).sort();
  const grain = data[0]?.period_grain || 'month';
  
  // Get unique combinations of entity + metric
  const metricCombinations = new Map<string, { entity: string; metric: string; label: string; type: string }>();
  data.forEach(row => {
    const key = `${row.entity_name}_${row.metric_name}`;
    if (!metricCombinations.has(key)) {
      metricCombinations.set(key, {
        entity: row.entity_name,
        metric: row.metric_name,
        label: row.metric_label,
        type: row.metric_type
      });
    }
  });

  // Build pivoted rows (without internal _period column)
  const pivotedData = periods.map(period => {
    const rowData: any = {
      Period: formatPeriodLabel(period, grain)
    };

    metricCombinations.forEach((combo, key) => {
      const matchingRow = data.find(
        r => r.period === period && 
             r.entity_name === combo.entity && 
             r.metric_name === combo.metric
      );

      if (matchingRow) {
        // Column name: "Entity - Metric Label" (e.g., "ORR Hotel - Total Revenue")
        const columnName = `${combo.entity} - ${combo.label}`;
        rowData[columnName] = formatValue(
          matchingRow.metric_value, 
          matchingRow.metric_type,
          matchingRow.metric_name
        );
      } else {
        const columnName = `${combo.entity} - ${combo.label}`;
        rowData[columnName] = '-';
      }
    });

    return rowData;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-2">
        <p className="text-xs text-muted-foreground">
          Showing {periods.length} periods × {metricCombinations.size} metrics
        </p>
        <p className="text-xs text-muted-foreground">
          Time grain: {grain.replace('_', ' ')}
        </p>
      </div>
      <PivotedCanonicalTable data={pivotedData} maxHeight={600} />
    </div>
  );
}
