import React, { createContext, useContext, useState, useCallback } from 'react';
import { WorkbookData, GlobalSchemaField, CellReference, SavedMapping, RecentUpload, Schema, FieldMapping, CleanTableRecord } from '@/types/excel';
import type { SavedMapping as SavedMappingType } from '@/types/excel';
import { parseExcelFile } from '@/lib/excelParser';
import { computeFormula, parseExcelFormula } from '@/lib/formulaComputer';
import { saveMappingToStorageLegacy, loadMappingFromStorage, getAllMappings } from '@/lib/mappingStorage';
import { exportCleanTable } from '@/lib/cleanTableStorage';
import { toast } from '@/hooks/use-toast';
import { useSupabaseSchemas } from '@/hooks/useSupabaseSchemas';
import { useSupabaseMappings } from '@/hooks/useSupabaseMappings';
import { useSupabaseCleanData } from '@/hooks/useSupabaseCleanData';
import { supabase } from '@/integrations/supabase/client';

interface ExcelContextType {
  // Workbook State
  workbookData: WorkbookData | null;
  schemaFields: GlobalSchemaField[];
  selectionMode: string | null;
  selectedSheet: string;
  isUploading: boolean;
  recentUploads: RecentUpload[];
  savedMappings: SavedMapping[];
  
  // Schema Management
  schemas: Schema[];
  createSchema: (schema: Schema) => Promise<void>;
  updateSchemaById: (id: string, updates: Partial<Schema>) => Promise<void>;
  deleteSchemaById: (id: string, deleteTable?: boolean) => Promise<void>;
  getSchema: (id: string) => Schema | null;
  refreshSchemas: () => void;
  isSchemasLoading: boolean;
  
  // Mapping Management
  saveMappingNew: (name: string, description: string, tags: string[], schemaId: string, fieldMappings: FieldMapping[]) => Promise<void>;
  updateMappingById: (id: string, name: string, description: string, tags: string[], schemaId: string, fieldMappings: FieldMapping[]) => Promise<void>;
  getMappingsForSchema: (schemaId: string) => SavedMapping[];
  loadMappingForEdit: (id: string) => void;
  clearLoadedMapping: () => void;
  loadedMappingForEdit: SavedMappingType | null;
  clearWorkbook: () => void;
  isMappingsLoading: boolean;
  
  // Clean Table Management
  saveDataToCleanTable: (schemaId: string, data: Record<string, any>, workbookName: string, mappingId: string) => Promise<void>;
  getCleanTable: (schemaId: string) => CleanTableRecord[];
  deleteCleanTableRecord: (schemaId: string, recordId: string) => Promise<void>;
  clearCleanTableData: (schemaId: string) => Promise<void>;
  exportCleanTableData: (schemaId: string, format: 'json' | 'csv') => string;
  isCleanDataLoading: boolean;
  
  // Legacy Methods
  uploadWorkbook: (file: File) => Promise<void>;
  selectCells: (cells: CellReference[]) => void;
  addSchemaField: () => void;
  removeSchemaField: (id: string) => void;
  updateField: (id: string, updates: Partial<GlobalSchemaField>) => void;
  startCellSelection: (fieldId: string) => void;
  stopCellSelection: () => void;
  computeFieldValue: (fieldId: string) => void;
  computeAllFields: () => void;
  saveMapping: (name: string) => void;
  loadMapping: (id: string) => void;
  setSelectedSheet: (sheet: string) => void;
  loadRecentUpload: (upload: RecentUpload) => void;
  refreshMappings: () => void;
  addFieldFromFormula: (formula: string, name?: string) => void;
}

const ExcelContext = createContext<ExcelContextType | undefined>(undefined);

export const ExcelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workbookData, setWorkbookData] = useState<WorkbookData | null>(null);
  const [schemaFields, setSchemaFields] = useState<GlobalSchemaField[]>([]);
  const [selectionMode, setSelectionMode] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [loadedMappingForEdit, setLoadedMappingForEdit] = useState<SavedMappingType | null>(null);
  
  // Use Supabase hooks for data management
  const { 
    schemas: supabaseSchemas, 
    isLoading: isSchemasLoading,
    createSchema: createSchemaSupabase,
    updateSchema: updateSchemaSupabase,
    deleteSchema: deleteSchemaSupabase,
  } = useSupabaseSchemas();
  
  const {
    mappings: supabaseMappings,
    isLoading: isMappingsLoading,
    createMapping: createMappingSupabase,
    updateMapping: updateMappingSupabase,
  } = useSupabaseMappings();
  
  const {
    cleanData: supabaseCleanData,
    isLoading: isCleanDataLoading,
    createCleanData: createCleanDataSupabase,
    deleteCleanData: deleteCleanDataSupabase,
    clearCleanData: clearCleanDataSupabase,
  } = useSupabaseCleanData();
  
  // Use the already converted data from Supabase hooks
  const schemas = supabaseSchemas || [];
  const savedMappings = supabaseMappings || [];

  const uploadWorkbook = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const data = await parseExcelFile(file);
      setWorkbookData(data);
      setSelectedSheet(data.sheetNames[0] || '');
      
      // Add to recent uploads
      const upload: RecentUpload = {
        id: `upload_${Date.now()}`,
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        uploadDate: new Date().toLocaleString(),
        workbookData: data,
      };
      setRecentUploads(prev => [upload, ...prev.slice(0, 4)]);
      
      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been parsed and loaded.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to parse Excel file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, []);

  const addSchemaField = useCallback(() => {
    const newField: GlobalSchemaField = {
      id: `field_${Date.now()}`,
      name: `Field ${schemaFields.length + 1}`,
      type: 'text',
      mappedCells: [],
      formula: '',
      computedValue: null,
    };
    setSchemaFields(prev => [...prev, newField]);
  }, [schemaFields.length]);

  const removeSchemaField = useCallback((id: string) => {
    setSchemaFields(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateField = useCallback((id: string, updates: Partial<GlobalSchemaField>) => {
    setSchemaFields(prev =>
      prev.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  const startCellSelection = useCallback((fieldId: string) => {
    setSelectionMode(fieldId);
  }, []);

  const stopCellSelection = useCallback(() => {
    setSelectionMode(null);
  }, []);

  const selectCells = useCallback((cells: CellReference[]) => {
    if (!selectionMode) return;
    
    setSchemaFields(prev =>
      prev.map(f =>
        f.id === selectionMode
          ? { ...f, mappedCells: [...f.mappedCells, ...cells] }
          : f
      )
    );
  }, [selectionMode]);

  const computeFieldValue = useCallback((fieldId: string) => {
    const field = schemaFields.find(f => f.id === fieldId);
    if (!field || !workbookData) return;
    
    const value = computeFormula(field.formula, field.mappedCells, workbookData);
    updateField(fieldId, { computedValue: value });
  }, [schemaFields, workbookData, updateField]);

  const computeAllFields = useCallback(() => {
    schemaFields.forEach(field => {
      const value = computeFormula(field.formula, field.mappedCells, workbookData);
      updateField(field.id, { computedValue: value });
    });
    toast({
      title: "Mapping applied",
      description: "All field values have been computed.",
    });
  }, [schemaFields, workbookData, updateField]);

  const saveMapping = useCallback((name: string) => {
    if (schemaFields.length === 0) {
      toast({
        title: "No fields to save",
        description: "Add at least one field before saving.",
        variant: "destructive",
      });
      return;
    }
    
    saveMappingToStorageLegacy(name, schemaFields);
    refreshMappings();
    toast({
      title: "Mapping saved",
      description: `"${name}" has been saved successfully.`,
    });
  }, [schemaFields]);

  const loadMapping = useCallback((id: string) => {
    const mapping = loadMappingFromStorage(id);
    if (!mapping) return;
    
    const fieldsWithComputed = mapping.fields.map(f => ({
      ...f,
      computedValue: null,
    }));
    setSchemaFields(fieldsWithComputed);
    toast({
      title: "Mapping loaded",
      description: `"${mapping.name}" has been loaded.`,
    });
  }, []);

  const loadRecentUpload = useCallback((upload: RecentUpload) => {
    setWorkbookData(upload.workbookData);
    setSelectedSheet(upload.workbookData.sheetNames[0] || '');
    toast({
      title: "Workbook loaded",
      description: `${upload.fileName} has been loaded.`,
    });
  }, []);

  const addFieldFromFormula = useCallback((formula: string, name?: string) => {
    if (!workbookData) return;
    
    // Parse formula to extract cell references
    const { cellRefs, operation } = parseExcelFormula(formula, selectedSheet, workbookData.sheetNames);
    
    if (cellRefs.length === 0) {
      toast({
        title: "Invalid formula",
        description: "No valid cell references found in formula.",
        variant: "destructive",
      });
      return;
    }
    
    // Compute value immediately
    const value = computeFormula(formula, cellRefs, workbookData);
    
    // Auto-detect type from computed value
    let type: 'text' | 'number' | 'date' | 'boolean' = 'text';
    if (typeof value === 'number') type = 'number';
    else if (typeof value === 'boolean') type = 'boolean';
    else if (value instanceof Date) type = 'date';
    
    // Auto-generate name if not provided
    const fieldName = name || `Formula ${schemaFields.length + 1}`;
    
    const newField: GlobalSchemaField = {
      id: `field_${Date.now()}`,
      name: fieldName,
      type,
      mappedCells: cellRefs,
      formula,
      computedValue: value,
    };
    
    setSchemaFields(prev => [...prev, newField]);
    
    toast({
      title: "Field added",
      description: `"${fieldName}" has been added to the schema.`,
    });
  }, [workbookData, selectedSheet, schemaFields.length]);

  const refreshMappings = useCallback(() => {
    // Mappings are automatically refreshed via react-query
  }, []);

  // Schema Management Functions
  const createSchema = useCallback(async (schema: Schema) => {
    await createSchemaSupabase({
      name: schema.name,
      description: schema.description,
      fields: schema.fields,
    });
  }, [createSchemaSupabase]);

  const updateSchemaById = useCallback(async (id: string, updates: Partial<Schema>) => {
    await updateSchemaSupabase({
      id,
      updates: {
        name: updates.name,
        description: updates.description,
        fields: updates.fields,
      },
    });
  }, [updateSchemaSupabase]);

  const deleteSchemaById = useCallback(async (id: string, deleteTable: boolean = false) => {
    await deleteSchemaSupabase({ id, deleteTable });
  }, [deleteSchemaSupabase]);

  const getSchema = useCallback((id: string) => {
    return schemas.find(s => s.id === id) || null;
  }, [schemas]);

  const refreshSchemas = useCallback(() => {
    // Schemas are automatically refreshed via react-query
  }, []);

  // New Mapping Functions
  const saveMappingNew = useCallback(async (
    name: string,
    description: string,
    tags: string[],
    schemaId: string,
    fieldMappings: FieldMapping[]
  ) => {
    await createMappingSupabase({
      name,
      description,
      tags,
      schemaId,
      fieldMappings,
    });
  }, [createMappingSupabase]);

  const updateMappingById = useCallback(async (
    id: string,
    name: string,
    description: string,
    tags: string[],
    schemaId: string,
    fieldMappings: FieldMapping[]
  ) => {
    await updateMappingSupabase({
      id,
      updates: {
        name,
        description,
        tags,
        fieldMappings,
      },
    });
    setLoadedMappingForEdit(null); // Clear after update
  }, [updateMappingSupabase]);

  const getMappingsForSchema = useCallback((schemaId: string) => {
    return (supabaseMappings || []).filter(m => m.schemaId === schemaId);
  }, [supabaseMappings]);

  const loadMappingForEdit = useCallback((id: string) => {
    const mapping = (supabaseMappings || []).find(m => m.id === id);
    if (mapping) {
      setLoadedMappingForEdit(mapping);
      toast({
        title: "Mapping loaded for editing",
        description: `"${mapping.name}" is now ready to edit.`,
      });
    }
  }, [supabaseMappings]);

  const clearLoadedMapping = useCallback(() => {
    setLoadedMappingForEdit(null);
  }, []);

  const clearWorkbook = useCallback(() => {
    setWorkbookData(null);
    setLoadedMappingForEdit(null);
  }, []);

  // Clean Table Functions
  const saveDataToCleanTable = useCallback(async (
    schemaId: string,
    data: Record<string, any>,
    workbookName: string,
    mappingId: string
  ) => {
    // Get schema to determine table name
    const schema = schemas.find(s => s.id === schemaId);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaId}`);
    }

    // Sanitize the table name by removing special characters
    const tableName = `clean_${schema.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')}`;

    // Use new edge function to insert data into schema-specific table
    const { data: insertResult, error } = await supabase.functions.invoke('insert-clean-data', {
      body: {
        tableName,
        data,
        sourceWorkbook: workbookName,
        sourceMappingId: mappingId
      }
    });

    if (error) {
      throw new Error(`Failed to save data: ${error.message}`);
    }

    if (!insertResult?.success) {
      throw new Error(insertResult?.error || 'Failed to save data to table');
    }

    // Also keep a record in the old clean_data table for backward compatibility (optional)
    await createCleanDataSupabase({
      schemaId,
      data,
      sourceWorkbook: workbookName,
      sourceMappingId: mappingId,
    });
  }, [schemas, createCleanDataSupabase]);

  const getCleanTable = useCallback((schemaId: string) => {
    return (supabaseCleanData || []).filter(record => record.schemaId === schemaId);
  }, [supabaseCleanData]);

  const deleteCleanTableRecord = useCallback(async (schemaId: string, recordId: string) => {
    await deleteCleanDataSupabase(recordId);
  }, [deleteCleanDataSupabase]);

  const clearCleanTableData = useCallback(async (schemaId: string) => {
    await clearCleanDataSupabase(schemaId);
  }, [clearCleanDataSupabase]);

  const exportCleanTableData = useCallback((schemaId: string, format: 'json' | 'csv') => {
    const records = getCleanTable(schemaId);
    
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
  }, [getCleanTable]);


  return (
    <ExcelContext.Provider
      value={{
        workbookData,
        schemaFields,
        selectionMode,
        selectedSheet,
        isUploading,
        recentUploads,
        savedMappings,
        schemas,
        createSchema,
        updateSchemaById,
        deleteSchemaById,
        getSchema,
        refreshSchemas,
        isSchemasLoading,
        saveMappingNew,
        updateMappingById,
        getMappingsForSchema,
        loadMappingForEdit,
        clearLoadedMapping,
        loadedMappingForEdit,
        clearWorkbook,
        isMappingsLoading,
        saveDataToCleanTable,
        getCleanTable,
        deleteCleanTableRecord,
        clearCleanTableData,
        exportCleanTableData,
        isCleanDataLoading,
        uploadWorkbook,
        selectCells,
        addSchemaField,
        removeSchemaField,
        updateField,
        startCellSelection,
        stopCellSelection,
        computeFieldValue,
        computeAllFields,
        saveMapping,
        loadMapping,
        setSelectedSheet,
        loadRecentUpload,
        refreshMappings,
        addFieldFromFormula,
      }}
    >
      {children}
    </ExcelContext.Provider>
  );
};

export const useExcel = () => {
  const context = useContext(ExcelContext);
  if (!context) {
    throw new Error('useExcel must be used within ExcelProvider');
  }
  return context;
};
