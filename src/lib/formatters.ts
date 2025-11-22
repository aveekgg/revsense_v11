/**
 * Format a number value for clean display
 * - Rounds decimals to 2 places (or 0 for counts)
 * - Adds thousand separators
 * - Handles percentages (converts 0-1 to 0-100)
 * - Returns original value if not a number
 */
export function formatNumber(value: any, fieldName?: string, fieldType?: string): string {
  if (value === null || value === undefined || value === '') return '-';
  
  const num = Number(value);
  if (isNaN(num)) return String(value);
  
  // Check explicit type first
  if (fieldType === 'integer') {
    return Math.round(num).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  
  // Safe field name checking - ensure it's a string before calling toLowerCase()
  const lowerFieldName = (typeof fieldName === 'string' ? fieldName.toLowerCase() : '') || '';
  
  // Handle percentages - convert from fraction (0-1) to percentage (0-100)
  if (lowerFieldName.includes('percent') || lowerFieldName.includes('rate') || 
      lowerFieldName.includes('ratio') || lowerFieldName.includes('_pct') ||
      lowerFieldName.endsWith('_rate') || lowerFieldName.includes('margin')) {
    
    let percentValue = num;
    // If value is between 0 and 1, convert to percentage
    if (num >= 0 && num <= 1) {
      percentValue = num * 100;
    }
    
    return percentValue.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + '%';
  }
  
  // Handle count fields - no decimals
  if (lowerFieldName.includes('count') || lowerFieldName.includes('quantity') || 
      lowerFieldName.includes('qty') || lowerFieldName.includes('number') ||
      lowerFieldName.includes('total_rooms') || lowerFieldName.includes('occupied_rooms')) {
    
    return Math.round(num).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  
  // Default: Round to 2 decimal places for revenue, amounts, etc.
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Format currency values with proper currency symbol
 */
export function formatCurrency(value: any, currency: string = 'USD'): string {
  if (value === null || value === undefined || value === '') return '-';
  
  const num = Number(value);
  if (isNaN(num)) return String(value);
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format percentage values (ensures 0-100 range display)
 */
export function formatPercentage(value: any): string {
  if (value === null || value === undefined || value === '') return '-';
  
  const num = Number(value);
  if (isNaN(num)) return String(value);
  
  // If value is between 0 and 1, convert to percentage
  let percentValue = num;
  if (num >= 0 && num <= 1) {
    percentValue = num * 100;
  }
  
  return percentValue.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) + '%';
}

/**
 * Format a date value for clean display
 */
export function formatDate(value: any): string {
  if (!value) return '-';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    
    // Format as YYYY-MM-DD
    return date.toISOString().split('T')[0];
  } catch {
    return String(value);
  }
}

/**
 * Format a timestamp value for clean display
 */
export function formatTimestamp(value: any): string {
  if (!value) return '-';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    
    // Format as "Nov 8, 2025, 1:49 PM"
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(value);
  }
}

/**
 * Smart format - detects type and formats accordingly
 */
export function formatValue(value: any, fieldName?: string, fieldType?: string): string {
  if (value === null || value === undefined || value === '') return '-';
  
  // PRIORITY 1: Use explicit field type if available (schema-based formatting)
  if (fieldType) {
    switch (fieldType) {
      case 'currency':
        return formatCurrency(value);
      case 'integer':
        return Math.round(Number(value)).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      case 'number':
        return formatNumber(value, fieldName, fieldType);
      case 'date':
        return formatDate(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'text':
      case 'enum':
        return String(value);
    }
  }
  
  // PRIORITY 2: Fall back to field name heuristics (for SQL queries without schema)
  // Safe field name checking - ensure it's a string before calling toLowerCase()
  const lowerFieldName = (typeof fieldName === 'string' ? fieldName.toLowerCase() : '') || '';
  
  // Check if it's a timestamp/date field
  if (lowerFieldName.includes('_at') || lowerFieldName.includes('date') || 
      lowerFieldName.includes('timestamp') || lowerFieldName.includes('created') ||
      lowerFieldName.includes('updated') || lowerFieldName.includes('extracted')) {
    return formatTimestamp(value);
  }
  
  // Check if it's a currency field (more specific patterns to avoid false positives)
  if (lowerFieldName.includes('revenue') || lowerFieldName.includes('amount') || 
      lowerFieldName.includes('price') || lowerFieldName.includes('cost') ||
      lowerFieldName.includes('adr') || lowerFieldName.includes('revpar') ||
      lowerFieldName.includes('fee') || lowerFieldName.includes('total_revenue') ||
      lowerFieldName.includes('total_amount') || lowerFieldName.includes('total_cost') ||
      lowerFieldName.includes('total_price') || lowerFieldName.includes('grand_total') ||
      lowerFieldName.includes('subtotal') || lowerFieldName.endsWith('_total')) {
    // Exclude count fields
    if (!lowerFieldName.includes('rooms') && !lowerFieldName.includes('count') && 
        !lowerFieldName.includes('bookings') && !lowerFieldName.includes('guests') &&
        !lowerFieldName.includes('quantity') && !lowerFieldName.includes('available')) {
      return formatCurrency(value);
    }
  }
  
  // Check if it's a percentage field
  if (lowerFieldName.includes('percent') || lowerFieldName.includes('rate') || 
      lowerFieldName.includes('ratio') || lowerFieldName.includes('_pct') ||
      lowerFieldName.endsWith('_rate') || lowerFieldName.includes('margin') ||
      lowerFieldName.includes('occupancy')) {
    return formatPercentage(value);
  }
  
  // Check if it's a number
  if (typeof value === 'number') {
    return formatNumber(value, fieldName, fieldType);
  }
  
  // Check if string represents a number
  const num = Number(value);
  if (!isNaN(num) && value !== '' && typeof value !== 'boolean') {
    return formatNumber(num, fieldName, fieldType);
  }
  
  return String(value);
}

/**
 * Format table cell value based on column name and value
 * This is the main function to use for table displays
 */
export function formatTableCell(value: any, columnName?: string, fieldType?: string): string {
  return formatValue(value, columnName, fieldType);
}

/**
 * Detect if a field should be treated as currency based on name patterns
 */
export function isCurrencyField(fieldName: string): boolean {
  if (typeof fieldName !== 'string') return false;
  const lowerName = fieldName.toLowerCase();
  return lowerName.includes('revenue') || lowerName.includes('amount') || 
         lowerName.includes('price') || lowerName.includes('cost') ||
         lowerName.includes('total') || lowerName.includes('adr') ||
         lowerName.includes('revpar') || lowerName.includes('fee');
}

/**
 * Detect if a field should be treated as percentage based on name patterns
 */
export function isPercentageField(fieldName: string): boolean {
  if (typeof fieldName !== 'string') return false;
  const lowerName = fieldName.toLowerCase();
  return lowerName.includes('percent') || lowerName.includes('rate') || 
         lowerName.includes('ratio') || lowerName.includes('_pct') ||
         lowerName.endsWith('_rate') || lowerName.includes('margin') ||
         lowerName.includes('occupancy');
}

/**
 * Detect if a field should be treated as count/integer based on name patterns
 */
export function isCountField(fieldName: string): boolean {
  if (typeof fieldName !== 'string') return false;
  const lowerName = fieldName.toLowerCase();
  return lowerName.includes('count') || lowerName.includes('quantity') || 
         lowerName.includes('qty') || lowerName.includes('number') ||
         lowerName.includes('rooms') || lowerName.includes('guests') ||
         lowerName.includes('bookings') || lowerName.includes('nights') ||
         lowerName.includes('stays') || lowerName.includes('units');
}

/**
 * Enhanced formatter for Excel computed values
 * This is specifically for mapping/formula computation displays
 */
export function formatExcelValue(value: any, fieldName?: string, fieldType?: string): string {
  if (value === null || value === undefined || value === '') return '-';
  
  // Use field name for smart detection
  if (fieldName) {
    return formatValue(value, fieldName);
  }
  
  // Fallback to field type if no name available
  if (fieldType) {
    switch (fieldType) {
      case 'integer':
        return Math.round(Number(value)).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      case 'number':
        return formatNumber(value);
      case 'date':
        return formatDate(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      default:
        return String(value);
    }
  }
  
  return formatValue(value);
}

/**
 * Format values for chart tooltips and axis labels
 * This ensures consistent formatting across all visualizations
 */
export function formatChartValue(value: any, dataKey?: string, options?: {
  type?: 'currency' | 'percentage' | 'number' | 'integer';
  currency?: string;
  fieldType?: string;
}): string {
  if (value === null || value === undefined) return '-';
  
  // Use explicit type if provided
  if (options?.type === 'currency' || options?.fieldType === 'currency') {
    return formatCurrency(value, options.currency);
  }
  if (options?.type === 'percentage') {
    return formatPercentage(value);
  }
  if (options?.type === 'integer' || options?.fieldType === 'integer') {
    return formatNumber(value, dataKey, 'integer');
  }
  if (options?.type === 'number' || options?.fieldType === 'number') {
    return formatNumber(value, dataKey);
  }
  
  // Smart detection based on dataKey and fieldType
  return formatValue(value, dataKey, options?.fieldType);
}
