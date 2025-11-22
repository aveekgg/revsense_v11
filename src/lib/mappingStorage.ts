import { SavedMapping, GlobalSchemaField, FieldMapping } from '@/types/excel';

const STORAGE_KEY = 'revsense_excel_mappings';

export const saveMappingToStorage = (
  name: string,
  description: string,
  tags: string[],
  schemaId: string,
  fieldMappings: FieldMapping[],
  workbookFormat?: string
): SavedMapping => {
  const mappings = getAllMappings();
  
  const newMapping: SavedMapping = {
    id: `mapping_${Date.now()}`,
    name,
    description,
    tags,
    schemaId,
    workbookFormat,
    fieldMappings,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  mappings.push(newMapping);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  
  return newMapping;
};

// Legacy support
export const saveMappingToStorageLegacy = (name: string, fields: GlobalSchemaField[]): SavedMapping => {
  const mappings = getAllMappings();
  
  const newMapping: SavedMapping = {
    id: `mapping_${Date.now()}`,
    name,
    description: '',
    tags: [],
    schemaId: '',
    fieldMappings: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    fields: fields.map(({ computedValue, ...rest }) => rest),
  };
  
  mappings.push(newMapping);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  
  return newMapping;
};

export const loadMappingFromStorage = (id: string): SavedMapping | null => {
  const mappings = getAllMappings();
  return mappings.find(m => m.id === id) || null;
};

export const getMappingsBySchema = (schemaId: string): SavedMapping[] => {
  return getAllMappings().filter(m => m.schemaId === schemaId);
};

export const updateMapping = (id: string, updates: Partial<SavedMapping>): void => {
  const mappings = getAllMappings();
  const index = mappings.findIndex(m => m.id === id);
  
  if (index >= 0) {
    mappings[index] = { 
      ...mappings[index], 
      ...updates, 
      updatedAt: new Date() 
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  }
};

export const getAllMappings = (): SavedMapping[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  try {
    const mappings = JSON.parse(stored);
    return mappings.map((m: any) => ({
      ...m,
      createdAt: new Date(m.createdAt),
      updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(m.createdAt),
    }));
  } catch {
    return [];
  }
};

export const deleteMappingFromStorage = (id: string): void => {
  const mappings = getAllMappings();
  const filtered = mappings.filter(m => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};
