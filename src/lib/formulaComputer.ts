import { WorkbookData, CellReference } from '@/types/excel';
import { getRangeValues, getCellValue } from './excelParser';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { formatNumber as smartFormatNumber, formatDate as smartFormatDate, formatValue as smartFormatValue } from '@/lib/formatters';

// Detect if formula is a constant value (no cell references)
const detectConstant = (formula: string): { isConstant: boolean; value: any } => {
  const cleanFormula = formula.trim();
  
  // Remove leading = if present
  const formulaText = cleanFormula.startsWith('=') ? cleanFormula.slice(1).trim() : cleanFormula;
  
  // Check if it contains cell references or functions
  const hasCellRefs = /[A-Z]+\d+/i.test(formulaText);
  const hasFunctions = /^(SUM|AVERAGE|AVG|COUNT|MIN|MAX|CONCAT|JOIN|AI)\s*\(/i.test(formulaText);
  const hasOperators = /[+\-*/]/.test(formulaText);
  
  if (hasCellRefs || hasFunctions || hasOperators) {
    return { isConstant: false, value: null };
  }
  
  // Check for string constant (quoted or unquoted)
  const stringMatch = formulaText.match(/^["'](.*)["']$/);
  if (stringMatch) {
    return { isConstant: true, value: stringMatch[1] };
  }
  
  // Check for boolean constant
  const lowerFormula = formulaText.toLowerCase();
  if (lowerFormula === 'true') {
    return { isConstant: true, value: true };
  }
  if (lowerFormula === 'false') {
    return { isConstant: true, value: false };
  }
  
  // Check for numeric constant
  const numValue = Number(formulaText);
  if (!isNaN(numValue) && formulaText !== '') {
    return { isConstant: true, value: numValue };
  }
  
  // Treat unquoted text as string constant
  if (formulaText.length > 0) {
    return { isConstant: true, value: formulaText };
  }
  
  return { isConstant: false, value: null };
};

/**
 * Parse a value as a number, handling formatted strings with commas, currency symbols, etc.
 */
const parseNumericValue = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  
  // If already a number, return it
  if (typeof value === 'number') return value;
  
  // Convert to string and strip formatting
  const rawStr = String(value);
  const isNegative = rawStr.includes('(') && rawStr.includes(')'); // Accounting format
  const numStr = rawStr
    .replace(/[$€£¥,\s()]/g, '')  // Strip currency symbols, commas, spaces, parentheses
    .trim();
  
  const num = Number(numStr);
  if (isNaN(num)) return null;
  
  return isNegative ? -num : num;
};

// Smart type casting based on schema field type
const castToType = (value: any, targetType: string, enumOptions?: string[]): any => {
  if (value === null || value === undefined || value === '') return null;
  
  switch (targetType) {
    case 'enum':
      if (!enumOptions || enumOptions.length === 0) {
        console.warn('Enum type specified but no options provided');
        return null;
      }
      const stringValue = String(value).trim();
      const matchedOption = enumOptions.find(
        opt => opt.toLowerCase() === stringValue.toLowerCase()
      );
      if (!matchedOption) {
        console.warn(`Value "${stringValue}" not in allowed options: ${enumOptions.join(', ')}`);
        return null;
      }
      return matchedOption;
    
    case 'text':
      return String(value);
    
    case 'number':
    case 'currency':
      // Remove currency symbols ($, €, £, ¥), commas, and whitespace
      const rawStr = String(value);
      const isNegative = rawStr.includes('(') && rawStr.includes(')'); // Accounting format
      const numStr = rawStr
        .replace(/[$€£¥,\s()]/g, '')  // Strip symbols, commas, spaces, parentheses
        .trim();
      
      const num = Number(numStr);
      if (isNaN(num)) return null;
      return isNegative ? -num : num;
    
    case 'date':
      if (typeof value === 'number') {
        const excelEpoch = new Date(1900, 0, 1);
        const days = value - 2;
        return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
      }
      const dateAttempt = new Date(value);
      return isNaN(dateAttempt.getTime()) ? null : dateAttempt;
    
    case 'boolean':
      if (typeof value === 'boolean') return value;
      const lowerVal = String(value).toLowerCase().trim();
      if (lowerVal === 'true' || lowerVal === 'yes' || lowerVal === '1') return true;
      if (lowerVal === 'false' || lowerVal === 'no' || lowerVal === '0') return false;
      return null;
    
    default:
      return value;
  }
};

// Helper function to parse cell references using known sheet names
const parseCellReferencesWithSheets = (
  formulaText: string,
  currentSheet: string,
  availableSheets: string[]
): CellReference[] => {
  const cellRefs: CellReference[] = [];
  const sortedSheets = [...availableSheets].sort((a, b) => b.length - a.length);
  
  let remainingFormula = formulaText;
  let position = 0;
  
  while (position < remainingFormula.length) {
    // Look for quoted sheet name
    const quotedMatch = remainingFormula.substring(position).match(/^'([^']+)'!([A-Z]+\d+(?::[A-Z]+\d+)?)/i);
    if (quotedMatch) {
      cellRefs.push({ 
        pattern: quotedMatch[0],
        sheet: quotedMatch[1], 
        cell: quotedMatch[2] 
      });
      position += quotedMatch[0].length;
      continue;
    }
    
    // Look for unquoted sheet name from known sheets
    let foundSheet = false;
    for (const sheetName of sortedSheets) {
      if (remainingFormula.substring(position).startsWith(`${sheetName}!`)) {
        const afterSheet = remainingFormula.substring(position + sheetName.length + 1);
        const cellMatch = afterSheet.match(/^([A-Z]+\d+(?::[A-Z]+\d+)?)/i);
        if (cellMatch) {
          cellRefs.push({ 
            pattern: `${sheetName}!${cellMatch[1]}`,
            sheet: sheetName, 
            cell: cellMatch[1] 
          });
          position += sheetName.length + 1 + cellMatch[1].length;
          foundSheet = true;
          break;
        }
      }
    }
    
    if (foundSheet) continue;
    
    // Look for cell reference without sheet name
    const cellMatch = remainingFormula.substring(position).match(/^([A-Z]+\d+(?::[A-Z]+\d+)?)/i);
    if (cellMatch) {
      cellRefs.push({ 
        pattern: cellMatch[1],
        sheet: currentSheet, 
        cell: cellMatch[1] 
      });
      position += cellMatch[1].length;
      continue;
    }
    
    // Move to next character
    position++;
  }
  
  return cellRefs;
};

// Resolve AI functions recursively - replaces AI() calls with their computed values
const resolveAIFunctions = async (
  formula: string,
  workbookData: WorkbookData,
  targetType?: string,
  enumOptions?: string[]
): Promise<string> => {
  const aiRegex = /AI\s*\(\s*["']([^"']+)["']\s*,\s*([^)]+)\)/gi;
  let resolvedFormula = formula;
  
  // Find all AI functions
  const aiCalls: Array<{ fullMatch: string; prompt: string; cellArg: string }> = [];
  let match;
  
  while ((match = aiRegex.exec(formula)) !== null) {
    aiCalls.push({
      fullMatch: match[0],
      prompt: match[1],
      cellArg: match[2].trim()
    });
  }
  
  console.log(`Found ${aiCalls.length} AI function(s) to resolve`);
  
  // Evaluate each AI function sequentially and replace with result
  for (const aiCall of aiCalls) {
    console.log('Resolving AI function:', aiCall.fullMatch);
    
    // Parse cell references from the AI function's cell argument
    const cellRefs = parseCellReferencesWithSheets(
      aiCall.cellArg,
      workbookData.sheetNames[0],
      workbookData.sheetNames
    );
    
    // Get cell data
    const cellData = cellRefs.flatMap(ref =>
      getRangeValues(workbookData, ref.sheet, ref.cell)
    ).filter(v => v !== null && v !== '');
    
    if (cellData.length === 0) {
      throw new Error(`No data found for AI function: ${aiCall.fullMatch}`);
    }
    
    // Call AI formula edge function
    const { data: result, error } = await supabase.functions.invoke('ai-formula', {
      body: {
        prompt: aiCall.prompt,
        cellData,
        fieldType: targetType || 'number', // Default to number for math operations
        enumOptions
      }
    });
    
    if (error) {
      throw new Error(`AI function failed (${aiCall.prompt}): ${error.message}`);
    }
    
    console.log(`AI function resolved to: ${result.value}`);
    
    // Replace AI function with its result in the formula
    // Use a safe string replacement to avoid regex special characters
    resolvedFormula = resolvedFormula.replace(aiCall.fullMatch, String(result.value));
  }
  
  return resolvedFormula;
};

// Resolve a single AI function and return the typed result directly
const resolveSingleAIFunction = async (
  formula: string,
  workbookData: WorkbookData,
  targetType?: string,
  enumOptions?: string[]
): Promise<any> => {
  const aiRegex = /AI\s*\(\s*["']([^"']+)["']\s*,\s*([^)]+)\)/i;
  const match = aiRegex.exec(formula);
  
  if (!match) {
    throw new Error('Invalid AI function syntax');
  }
  
  const prompt = match[1];
  const cellArg = match[2].trim();
  
  // Parse cell references
  const cellRefs = parseCellReferencesWithSheets(
    cellArg,
    workbookData.sheetNames[0],
    workbookData.sheetNames
  );
  
  // Get cell data
  const cellData = cellRefs.flatMap(ref =>
    getRangeValues(workbookData, ref.sheet, ref.cell)
  ).filter(v => v !== null && v !== '');
  
  if (cellData.length === 0) {
    throw new Error(`No data found for AI function: ${formula}`);
  }
  
  // Call AI formula edge function
  const { data: result, error } = await supabase.functions.invoke('ai-formula', {
    body: {
      prompt,
      cellData,
      fieldType: targetType || 'text',
      enumOptions
    }
  });
  
  if (error) {
    throw new Error(`AI function failed: ${error.message}`);
  }
  
  console.log(`AI function resolved to:`, result.value);
  
  // Cast the result to the target type directly
  return targetType ? castToType(result.value, targetType, enumOptions) : result.value;
};

// Parse Excel-style formula: =A1+B1, =SUM(A1:A10), =Sheet2!C5*2, =AI("prompt", A1)
export const parseExcelFormula = (
  formula: string, 
  currentSheet: string, 
  availableSheets?: string[]
): {
  cellRefs: CellReference[];
  operation: string;
} => {
  const cellRefs: CellReference[] = [];
  const cleanFormula = formula.trim();
  
  // Remove leading = if present
  let formulaText = cleanFormula.startsWith('=') ? cleanFormula.slice(1) : cleanFormula;
  
  // Normalize ranges with repeated sheet names: Sheet4!B23:Sheet4!B25 -> Sheet4!B23:B25
  // Handle both quoted and unquoted sheet names (with special characters like &, -, etc.)
  formulaText = formulaText.replace(/'([^']+)'!([A-Z]+\d+):\1!([A-Z]+\d+)/gi, "'$1'!$2:$3");
  formulaText = formulaText.replace(/([^'\"!]+)!([A-Z]+\d+):\1!([A-Z]+\d+)/gi, '$1!$2:$3');
  
  // Extract all cell references using smart sheet-aware parsing if available
  if (availableSheets && availableSheets.length > 0) {
    const refs = parseCellReferencesWithSheets(formulaText, currentSheet, availableSheets);
    cellRefs.push(...refs);
  } else {
    // Fallback to regex if sheet names not available
    const cellRefRegex = /(?:(?:'([^']+)'|([^'\"!]+))!)?([A-Z]+\d+(?::[A-Z]+\d+)?)/gi;
    let match;
    
    while ((match = cellRefRegex.exec(formulaText)) !== null) {
      const sheetName = match[1] || match[2] || currentSheet;
      const cellAddress = match[3];
      cellRefs.push({ pattern: match[0], sheet: sheetName, cell: cellAddress });
    }
  }
  
  return {
    cellRefs,
    operation: formulaText
  };
};

// Compute formula with Excel-style support and AI functions
export const computeFormula = async (
  formula: string,
  mappedCells: CellReference[],
  workbookData: WorkbookData | null,
  targetType?: string,
  enumOptions?: string[]
): Promise<any> => {
  if (!workbookData) return null;
  
  // Check for constant value first (no cell references needed)
  const constantCheck = detectConstant(formula);
  if (constantCheck.isConstant) {
    return targetType ? castToType(constantCheck.value, targetType, enumOptions) : constantCheck.value;
  }
  
  // Check if formula is ONLY an AI function (with optional = prefix)
  const cleanFormula = formula.trim().replace(/^=/, '');
  const isOnlyAI = /^AI\s*\(/i.test(cleanFormula);

  if (isOnlyAI && formula.includes('AI(')) {
    try {
      console.log('Direct AI function call detected:', formula);
      const result = await resolveSingleAIFunction(formula, workbookData, targetType, enumOptions);
      console.log('AI function result:', result);
      return result; // Return directly, already cast to correct type
    } catch (error) {
      console.error('AI function resolution error:', error);
      throw error;
    }
  }

  // For complex formulas with AI functions, resolve them first
  let processedFormula = formula;
  if (formula.includes('AI(')) {
    try {
      console.log('Pre-processing AI functions in formula:', formula);
      processedFormula = await resolveAIFunctions(formula, workbookData, targetType, enumOptions);
      console.log('Formula after AI resolution:', processedFormula);
    } catch (error) {
      console.error('AI function resolution error:', error);
      throw error;
    }
  }
  
  // Parse the processed formula (AI functions now replaced with their values)
  const parsed = parseExcelFormula(processedFormula, workbookData.sheetNames[0], workbookData.sheetNames);
  const activeCellRefs = parsed.cellRefs; // Use these everywhere instead of mappedCells
  
  console.log('Active cell refs after parsing:', activeCellRefs);
  
  // Handle old-style simple formulas (SUM, AVG, etc.)
  const upperFormula = processedFormula.toUpperCase().trim();
  if (!processedFormula.includes('=') && !processedFormula.includes('+') && !processedFormula.includes('-') && 
      !processedFormula.includes('*') && !processedFormula.includes('/')) {
    const result = computeSimpleFormula(upperFormula, activeCellRefs, workbookData);
    return targetType ? castToType(result, targetType, enumOptions) : result;
  }
  
  // After AI resolution, if we have no cell refs but have operators, evaluate as pure expression
  if (activeCellRefs.length === 0 && /[+\-*/()]/.test(processedFormula)) {
    try {
      console.log('Evaluating pure mathematical expression:', processedFormula);
      const cleanExpr = processedFormula.trim().replace(/^=/, '');
      // Validate it's a safe mathematical expression (only numbers, operators, and parentheses)
      if (/^[\d+\-*/(). ]+$/.test(cleanExpr)) {
        console.log('Clean expression to evaluate:', cleanExpr);
        const result = Function(`"use strict"; return (${cleanExpr})`)();
        console.log('Pure expression result:', result);
        return targetType ? castToType(result, targetType, enumOptions) : result;
      } else {
        console.warn('Expression contains invalid characters:', cleanExpr);
      }
    } catch (error) {
      console.error('Failed to evaluate pure expression:', processedFormula, error);
      return null;
    }
  }
  
  // Handle Excel-style formulas
  if (activeCellRefs.length === 0) return null;
  
  const values = activeCellRefs.flatMap(ref => 
    getRangeValues(workbookData, ref.sheet, ref.cell)
  ).filter(v => v !== null && v !== '');
  
  if (values.length === 0) return null;
  
  try {
    // Parse and evaluate Excel-style formula with processed formula (AI functions resolved)
    const result = evaluateExcelFormula(processedFormula, activeCellRefs, workbookData, targetType, workbookData.sheetNames);
    return targetType ? castToType(result, targetType, enumOptions) : result;
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return null;
  }
};

// Evaluate Excel-style formulas with operators and functions
const evaluateExcelFormula = (
  formula: string,
  cellRefs: CellReference[],
  workbookData: WorkbookData,
  targetType?: string,
  availableSheets?: string[]
): any => {
  const cleanFormula = formula.trim().startsWith('=') ? formula.slice(1) : formula;
  const upperFormula = cleanFormula.toUpperCase();
  
  // Check for simple single cell reference
  // If we have exactly one cell reference and no functions, it's a simple cell reference
  const hasFunction = upperFormula.startsWith('SUM') ||
    upperFormula.startsWith('AVERAGE') ||
    upperFormula.startsWith('AVG') ||
    upperFormula.startsWith('COUNT') ||
    upperFormula.startsWith('MIN') ||
    upperFormula.startsWith('MAX') ||
    upperFormula.startsWith('CONCAT') ||
    upperFormula.startsWith('JOIN');

  const hasArithmeticOps = /[+\-*/()]/.test(cleanFormula);
  const isSingleCellRef = cellRefs.length === 1 && !hasFunction && !hasArithmeticOps;

  console.log('Formula debug:', {
    formula,
    cellRefs,
    isSingleCellRef,
    hasFunction,
    cleanFormula,
    upperFormula
  });

  if (isSingleCellRef) {
    const ref = cellRefs[0];
    console.log('Fetching single cell value:', ref);
    const values = getRangeValues(workbookData, ref.sheet, ref.cell);
    console.log('Got values:', values);
    return values[0] ?? null;
  }
  
  // Handle SUM function
  if (upperFormula.startsWith('SUM(')) {
    const values = cellRefs.flatMap(ref => 
      getRangeValues(workbookData, ref.sheet, ref.cell)
    ).filter(v => v !== null && v !== '').map(v => parseNumericValue(v) || 0);
    return values.reduce((sum, val) => sum + val, 0);
  }
  
  // Handle AVERAGE function
  if (upperFormula.startsWith('AVERAGE(') || upperFormula.startsWith('AVG(')) {
    const values = cellRefs.flatMap(ref => 
      getRangeValues(workbookData, ref.sheet, ref.cell)
    ).filter(v => parseNumericValue(v) !== null).map(v => parseNumericValue(v) as number);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
  
  // Handle COUNT function
  if (upperFormula.startsWith('COUNT(')) {
    return cellRefs.flatMap(ref => 
      getRangeValues(workbookData, ref.sheet, ref.cell)
    ).filter(v => v !== null && v !== '').length;
  }
  
  // Handle MIN function
  if (upperFormula.startsWith('MIN(')) {
    const values = cellRefs.flatMap(ref => 
      getRangeValues(workbookData, ref.sheet, ref.cell)
    ).filter(v => parseNumericValue(v) !== null).map(v => parseNumericValue(v) as number);
    return values.length > 0 ? Math.min(...values) : null;
  }
  
  // Handle MAX function
  if (upperFormula.startsWith('MAX(')) {
    const values = cellRefs.flatMap(ref => 
      getRangeValues(workbookData, ref.sheet, ref.cell)
    ).filter(v => parseNumericValue(v) !== null).map(v => parseNumericValue(v) as number);
    return values.length > 0 ? Math.max(...values) : null;
  }
  
  // Handle CONCAT function
  if (upperFormula.startsWith('CONCAT(') || upperFormula.startsWith('JOIN(')) {
    const values = cellRefs.flatMap(ref => 
      getRangeValues(workbookData, ref.sheet, ref.cell)
    ).filter(v => v !== null && v !== '').map(String);
    return values.join(' ');
  }
  
  // Handle basic arithmetic operations
  let expression = cleanFormula;
  
  console.log('=== FORMULA EVALUATION START ===');
  console.log('Original formula:', formula);
  console.log('Clean formula:', cleanFormula);
  console.log('Expression to evaluate:', expression);
  
  // Parse cell references using smart sheet-aware parsing
  const parsedRefs: { pattern: string; sheet: string; cell: string }[] = [];
  
  if (availableSheets && availableSheets.length > 0) {
    console.log('Using sheet-aware parsing with sheets:', availableSheets);
    const refs = parseCellReferencesWithSheets(cleanFormula, workbookData.sheetNames[0], availableSheets);
    console.log('Parsed refs from parser:', refs);
    
    for (const ref of refs) {
      // Use the pattern that was captured during parsing
      console.log('Processing ref:', ref, 'pattern:', ref.pattern);
      const pattern = ref.pattern || ref.cell;
      console.log('Final pattern to use:', pattern);
      
      parsedRefs.push({ 
        pattern, 
        sheet: ref.sheet, 
        cell: ref.cell 
      });
    }
    console.log('Final parsedRefs:', parsedRefs);
  } else {
    // Fallback to regex if sheet names not available
    const cellRefRegex = /(?:(?:'([^']+)'|([^'\"!]+))!)?([A-Z]+\d+)/gi;
    let match;
    
    while ((match = cellRefRegex.exec(cleanFormula)) !== null) {
      const sheetName = match[1] || match[2] || workbookData.sheetNames[0];
      const cellAddress = match[3];
      const pattern = match[0];
      parsedRefs.push({ pattern, sheet: sheetName, cell: cellAddress });
    }
  }
  
  // Replace cell references with their values
  console.log('=== REPLACEMENT PHASE ===');
  console.log('parsedRefs array:', JSON.stringify(parsedRefs, null, 2));
  
  parsedRefs.forEach((ref, idx) => {
    const values = getRangeValues(workbookData, ref.sheet, ref.cell);
    
    const refPattern = ref.pattern;
    console.log(`\n[${idx}] ======== Processing reference ${idx} ========`);
    console.log(`[${idx}] Pattern to find: "${refPattern}"`);
    console.log(`[${idx}] Sheet: "${ref.sheet}"`);
    console.log(`[${idx}] Cell: "${ref.cell}"`);
    console.log(`[${idx}] Values from sheet:`, values);
    console.log(`[${idx}] Current expression: "${expression}"`);
    console.log(`[${idx}] Does expression include pattern? ${expression.includes(refPattern)}`);
    
    if (values.length === 0 || values[0] === null || values[0] === undefined) {
      console.warn(`[${idx}] No value found for ${refPattern}`);
    }
    
    const value = values.length > 0 && values[0] !== null ? parseNumericValue(values[0]) : null;
    
    // Only replace if we have a valid numeric value
    if (value !== null && !isNaN(value)) {
      console.log(`[${idx}] Will replace with value: ${value}`);
      
      // Check if pattern exists in expression
      if (expression.includes(refPattern)) {
        console.log(`[${idx}] ✓ Pattern FOUND - replacing...`);
        // Simple string replacement
        const before = expression;
        expression = expression.split(refPattern).join(String(value));
        console.log(`[${idx}] BEFORE: "${before}"`);
        console.log(`[${idx}] AFTER:  "${expression}"`);
      } else {
        console.error(`[${idx}] ✗ Pattern NOT FOUND in expression!`);
        console.error(`[${idx}] Looking for: "${refPattern}"`);
        console.error(`[${idx}] In expression: "${expression}"`);
        
        // Try to find what might match
        const possiblePatterns = [
          `'${ref.sheet}'!${ref.cell}`,
          `${ref.sheet}!${ref.cell}`,
          ref.cell
        ];
        console.error(`[${idx}] Possible patterns to try:`, possiblePatterns);
        possiblePatterns.forEach(p => {
          console.error(`  - "${p}": ${expression.includes(p) ? 'FOUND' : 'not found'}`);
        });
      }
    } else {
      console.warn(`[${idx}] Skipping - invalid value`);
    }
  });
  
  console.log('Final expression to evaluate:', expression);
  
  // Check if any cell references remain unreplaced
  if (/[A-Z]+\d+/.test(expression)) {
    console.error('Formula still contains cell references:', expression);
    return null;
  }
  
  // Safely evaluate mathematical expression
  try {
    // Only allow numbers, operators, parentheses, and decimal points
    if (!/^[\d+\-*/(). ]+$/.test(expression)) {
      console.error('Invalid expression format:', expression);
      return null;
    }
    const result = Function(`"use strict"; return (${expression})`)();
    console.log('Evaluation result:', result);
    return result;
  } catch (error) {
    console.error('Failed to evaluate expression:', expression, error);
    return null;
  }
};

// Legacy simple formula support
const computeSimpleFormula = (
  formula: string,
  mappedCells: CellReference[],
  workbookData: WorkbookData
): any => {
  if (mappedCells.length === 0) return null;
  
  const values = mappedCells.flatMap(ref => 
    getRangeValues(workbookData, ref.sheet, ref.cell)
  ).filter(v => v !== null && v !== '');
  
  if (values.length === 0) return null;
  
  switch (formula) {
    case 'SUM':
      return values.reduce((sum, val) => sum + (Number(val) || 0), 0);
    case 'AVG':
    case 'AVERAGE':
      const numValues = values.filter(v => !isNaN(Number(v))).map(Number);
      return numValues.length > 0 
        ? numValues.reduce((a, b) => a + b, 0) / numValues.length 
        : 0;
    case 'COUNT':
      return values.length;
    case 'MIN':
      const minValues = values.filter(v => !isNaN(Number(v))).map(Number);
      return minValues.length > 0 ? Math.min(...minValues) : null;
    case 'MAX':
      const maxValues = values.filter(v => !isNaN(Number(v))).map(Number);
      return maxValues.length > 0 ? Math.max(...maxValues) : null;
    case 'CONCAT':
    case 'JOIN':
      return values.join(' ');
    default:
      if (values.length === 1) return values[0];
      return values.reduce((sum, val) => sum + (Number(val) || 0), 0);
  }
};

export const formatValue = (value: any, type: string): string => {
  if (value === null || value === undefined) return '-';
  
  switch (type) {
    case 'number':
      return typeof value === 'number' ? smartFormatNumber(value) : String(value);
    case 'date':
      return smartFormatDate(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return smartFormatValue(value);
  }
};
