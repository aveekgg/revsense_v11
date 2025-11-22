import { Schema } from '@/types/excel';

const STORAGE_KEY = 'revsense_schemas';

export const saveSchema = (schema: Schema): void => {
  const schemas = getAllSchemas();
  const existingIndex = schemas.findIndex(s => s.id === schema.id);
  
  if (existingIndex >= 0) {
    schemas[existingIndex] = { ...schema, updatedAt: new Date() };
  } else {
    schemas.push(schema);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schemas));
};

export const getSchemaById = (id: string): Schema | null => {
  const schemas = getAllSchemas();
  return schemas.find(s => s.id === id) || null;
};

export const getAllSchemas = (): Schema[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  try {
    const schemas = JSON.parse(stored);
    return schemas.map((s: any) => ({
      ...s,
      fields: Array.isArray(s.fields) ? s.fields : [],
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
    }));
  } catch {
    return [];
  }
};

export const updateSchema = (id: string, updates: Partial<Schema>): void => {
  const schema = getSchemaById(id);
  if (!schema) return;
  
  saveSchema({ ...schema, ...updates, updatedAt: new Date() });
};

export const deleteSchema = (id: string): void => {
  const schemas = getAllSchemas();
  const filtered = schemas.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};
