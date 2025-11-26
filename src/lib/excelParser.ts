import * as XLSX from 'xlsx';
import { WorkbookData, CellStyle } from '@/types/excel';

export const parseExcelFile = async (file: File): Promise<WorkbookData> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellStyles: true,
      cellHTML: false,
      cellFormula: true,
      cellDates: true
    });
    
    const sheets: Record<string, any[][]> = {};
    const cellStyles: Record<string, Record<string, CellStyle>> = {};
    const sheetNames = workbook.SheetNames;
    
    sheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to 2D array
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const sheetData: any[][] = [];
      
      // Always start from row 0 to preserve empty initial rows
      for (let R = 0; R <= range.e.r; R++) {
        const row: any[] = [];
        for (let C = 0; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          
          // Extract cell value
          let cellValue = null;
          if (cell) {
            // Prioritize raw value to preserve data types (numbers, dates, etc.)
            if (cell.v !== undefined) {
              cellValue = cell.v;
            } else if (cell.w) {
              // Fallback to formatted value
              cellValue = cell.w;
            }
            
            // Parse cell style if exists
            if (cell.s) {
              const style: CellStyle = {};
              const cellStyle = cell.s;
              
              // Font styles
              if (cellStyle.font) {
                if (cellStyle.font.bold) style.bold = true;
                if (cellStyle.font.italic) style.italic = true;
                if (cellStyle.font.underline) style.underline = true;
                if (cellStyle.font.color?.rgb) {
                  style.color = `#${cellStyle.font.color.rgb}`;
                }
              }
              
              // Background color
              if (cellStyle.fill?.fgColor?.rgb) {
                style.bgColor = `#${cellStyle.fill.fgColor.rgb}`;
              }
              
              // Borders
              if (cellStyle.border) {
                style.border = {
                  top: !!cellStyle.border.top,
                  right: !!cellStyle.border.right,
                  bottom: !!cellStyle.border.bottom,
                  left: !!cellStyle.border.left,
                };
              }
              
              if (Object.keys(style).length > 0) {
                if (!cellStyles[sheetName]) cellStyles[sheetName] = {};
                cellStyles[sheetName][cellAddress] = style;
              }
            }
          }
          
          row[C] = cellValue;
        }
        sheetData[R] = row;
      }
      
      sheets[sheetName] = sheetData;
    });
    
    return {
      fileName: file.name,
      sheets,
      sheetNames,
      uploadDate: new Date(),
      cellStyles,
    };
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error('Failed to parse Excel file. Please ensure it is a valid Excel file (.xlsx, .xls).');
  }
};


export const getCellValue = (
  workbookData: WorkbookData,
  sheetName: string,
  cellAddress: string
): any => {
  const sheet = workbookData.sheets[sheetName];
  if (!sheet) {
    console.warn(`Sheet "${sheetName}" not found in workbook`);
    return null;
  }
  
  // Parse cell address (e.g., "A1" -> row 0, col 0, "AF9" -> row 8, col 31)
  const match = cellAddress.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    console.warn(`Invalid cell address format: ${cellAddress}`);
    return null;
  }
  
  // Convert column letters to 0-based index (A=0, Z=25, AA=26, AF=31, etc.)
  const colLetters = match[1];
  let col = 0;
  for (let i = 0; i < colLetters.length; i++) {
    col = col * 26 + (colLetters.charCodeAt(i) - 64);
  }
  col = col - 1; // Convert to 0-based
  
  const row = parseInt(match[2]) - 1;
  
  const value = sheet[row]?.[col];
  if (value === undefined || value === null) {
    console.warn(`No value found at ${sheetName}!${cellAddress} (row: ${row}, col: ${col})`);
  }
  
  return value ?? null;
};

export const getRangeValues = (
  workbookData: WorkbookData,
  sheetName: string,
  range: string
): any[] => {
  const sheet = workbookData.sheets[sheetName];
  if (!sheet) {
    console.warn(`Sheet "${sheetName}" not found for range ${range}`);
    return [];
  }
  
  if (range.includes(':')) {
    const [start, end] = range.split(':');
    
    // Parse start cell
    const startMatch = start.match(/^([A-Z]+)(\d+)$/);
    const endMatch = end.match(/^([A-Z]+)(\d+)$/);
    if (!startMatch || !endMatch) return [];
    
    // Convert column letters to 0-based index
    const startColLetters = startMatch[1];
    let startCol = 0;
    for (let i = 0; i < startColLetters.length; i++) {
      startCol = startCol * 26 + (startColLetters.charCodeAt(i) - 64);
    }
    startCol = startCol - 1;
    
    const endColLetters = endMatch[1];
    let endCol = 0;
    for (let i = 0; i < endColLetters.length; i++) {
      endCol = endCol * 26 + (endColLetters.charCodeAt(i) - 64);
    }
    endCol = endCol - 1;
    
    const startRow = parseInt(startMatch[2]) - 1;
    const endRow = parseInt(endMatch[2]) - 1;
    
    const values: any[] = [];
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        values.push(sheet[r]?.[c] ?? null);
      }
    }
    return values;
  } else {
    return [getCellValue(workbookData, sheetName, range)];
  }
};

export const columnIndexToLetter = (index: number): string => {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
};
