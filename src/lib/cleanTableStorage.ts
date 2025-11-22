import { CleanTableRecord } from '@/types/excel';

const STORAGE_KEY = 'revsense_clean_tables';

interface CleanTableStorage {
  [schemaId: string]: CleanTableRecord[];
}

export const saveToCleanTable = (
  schemaId: string,
  fieldValues: Record<string, any>,
  workbookName: string,
  mappingId: string
): CleanTableRecord => {
  const tables = getAllCleanTables();
  
  const newRecord: CleanTableRecord = {
    id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    schemaId,
    data: fieldValues,
    sourceWorkbook: workbookName,
    sourceMappingId: mappingId,
    extractedAt: new Date(),
  };
  
  if (!tables[schemaId]) {
    tables[schemaId] = [];
  }
  
  tables[schemaId].push(newRecord);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  
  return newRecord;
};

export const getCleanTableData = (schemaId: string): CleanTableRecord[] => {
  const tables = getAllCleanTables();
  const records = tables[schemaId] || [];
  
  return records.map(r => ({
    ...r,
    extractedAt: new Date(r.extractedAt),
  }));
};

export const getAllCleanTables = (): CleanTableStorage => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return {};
  
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

export const deleteRecord = (schemaId: string, recordId: string): void => {
  const tables = getAllCleanTables();
  
  if (tables[schemaId]) {
    tables[schemaId] = tables[schemaId].filter(r => r.id !== recordId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  }
};

export const clearCleanTable = (schemaId: string): void => {
  const tables = getAllCleanTables();
  delete tables[schemaId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
};

export const exportCleanTable = (schemaId: string, format: 'json' | 'csv'): string => {
  const records = getCleanTableData(schemaId);
  
  if (format === 'json') {
    return JSON.stringify(records, null, 2);
  }
  
  // CSV export
  if (records.length === 0) return '';
  
  const allKeys = new Set<string>();
  records.forEach(record => {
    Object.keys(record.data).forEach(key => allKeys.add(key));
  });
  
  const headers = ['ID', 'Source Workbook', 'Extracted At', ...Array.from(allKeys)];
  const csvRows = [headers.join(',')];
  
  records.forEach(record => {
    const row = [
      record.id,
      record.sourceWorkbook,
      record.extractedAt.toISOString(),
      ...Array.from(allKeys).map(key => {
        const value = record.data[key];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value ?? '';
      })
    ];
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
};
