/**
 * Data Pivoting Utility
 * Detects non-pivoted (long format) data and transforms it to pivoted (wide format)
 * for proper multi-entity bar chart visualization
 */

export interface PivotDetectionResult {
  isNonPivoted: boolean;
  entityColumn?: string;
  categoryColumn?: string;
  metricColumns?: string[];
}

/**
 * Detects if data is in non-pivoted format
 * Non-pivoted: { month: 'May', hotel_name: 'Marriott', revenue: 177604 }
 * Pivoted: { month: 'May', marriott_revenue: 177604, raaya_revenue: 4052213 }
 */
export function detectDataStructure(data: any[]): PivotDetectionResult {
  if (!data || data.length === 0) {
    return { isNonPivoted: false };
  }

  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  // Detect entity column (hotel_name, asset_name, property_name, entity, etc.)
  const entityColumn = columns.find(col => {
    const lowerCol = col.toLowerCase();
    return (
      lowerCol.includes('_name') ||
      lowerCol.includes('hotel') ||
      lowerCol.includes('asset') ||
      lowerCol.includes('property') ||
      lowerCol.includes('entity') ||
      lowerCol.includes('product') ||
      lowerCol.includes('location')
    );
  });

  // Detect time/category column (month, date, period, category, etc.)
  const categoryColumn = columns.find(col => {
    const lowerCol = col.toLowerCase();
    return (
      lowerCol.includes('month') ||
      lowerCol.includes('date') ||
      lowerCol.includes('period') ||
      lowerCol.includes('quarter') ||
      lowerCol.includes('year') ||
      lowerCol.includes('category') ||
      lowerCol === 'name'
    );
  });

  // Detect metric columns (numeric fields)
  const metricColumns = columns.filter(col => 
    col !== entityColumn && 
    col !== categoryColumn && 
    typeof firstRow[col] === 'number'
  );

  const isNonPivoted = !!(entityColumn && categoryColumn && metricColumns.length >= 1);

  return {
    isNonPivoted,
    entityColumn,
    categoryColumn,
    metricColumns,
  };
}

/**
 * Pivots non-pivoted data to wide format
 * 
 * @example
 * Input:
 * [
 *   { month: 'May', hotel_name: 'Marriott', revenue: 177604 },
 *   { month: 'May', hotel_name: 'Raaya', revenue: 4052213 },
 *   { month: 'Jun', hotel_name: 'Marriott', revenue: 137273 }
 * ]
 * 
 * Output:
 * [
 *   { month: 'May', Marriott: 177604, Raaya: 4052213 },
 *   { month: 'Jun', Marriott: 137273, Raaya: 0 }
 * ]
 */
export function pivotData(
  data: any[],
  entityCol: string,
  categoryCol: string,
  metricCols: string[]
): any[] {
  if (!data || data.length === 0) return [];

  // Group by category
  const grouped = new Map<string, Map<string, any>>();

  data.forEach(row => {
    const category = row[categoryCol];
    const entity = row[entityCol];

    if (!grouped.has(category)) {
      grouped.set(category, new Map());
    }

    const categoryGroup = grouped.get(category)!;

    // For each metric, store the value under entity name
    metricCols.forEach(metric => {
      const value = row[metric];
      
      // If multiple metrics, use format: entityName_metricName
      // If single metric, just use entityName
      const key = metricCols.length > 1 
        ? `${entity}_${metric}`
        : entity;
        
      categoryGroup.set(key, value);
    });
  });

  // Convert to array format
  const result: any[] = [];
  
  grouped.forEach((entityValues, category) => {
    const rowData: any = { [categoryCol]: category };
    
    entityValues.forEach((value, entityKey) => {
      rowData[entityKey] = value;
    });
    
    result.push(rowData);
  });

  return result;
}

/**
 * Auto-detects and pivots data if needed
 */
export function autoPivot(data: any[]): { 
  data: any[]; 
  wasPivoted: boolean; 
  detection: PivotDetectionResult;
} {
  const detection = detectDataStructure(data);

  if (!detection.isNonPivoted) {
    return { data, wasPivoted: false, detection };
  }

  const pivotedData = pivotData(
    data,
    detection.entityColumn!,
    detection.categoryColumn!,
    detection.metricColumns!
  );

  return { 
    data: pivotedData, 
    wasPivoted: true, 
    detection 
  };
}
