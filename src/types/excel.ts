export interface CellReference {
  pattern?: string; // Full pattern as it appears in formula (e.g., "'P&L SUMMARY - NET'!B20")
  sheet: string;
  cell: string; // e.g., "A1" or "A1:B10"
}

// Schema Definition (Clean Table Structure)
export interface Schema {
  id: string;
  name: string; // Table name (e.g., "sfs", "p_and_l_summary")
  description: string;
  fields: SchemaField[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SchemaField {
  id: string;
  name: string; // Field name (e.g., "field1", "monthly_revenue")
  displayLabel: string; // Human-readable (e.g., "Monthly Revenue")
  type: 'text' | 'integer' | 'number' | 'date' | 'boolean' | 'currency' | 'enum';
  description: string;
  required: boolean;
  defaultValue?: any;
  enumOptions?: string[]; // Allowed values for enum type
}

// Legacy - keeping for backward compatibility
export interface GlobalSchemaField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  mappedCells: CellReference[];
  formula: string; // e.g., "SUM", "AVG", "A1+B1"
  computedValue: any;
}

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bgColor?: string;
  border?: {
    top?: boolean;
    right?: boolean;
    bottom?: boolean;
    left?: boolean;
  };
}

export interface CellData {
  value: any;
  style?: CellStyle;
}

export interface WorkbookData {
  fileName: string;
  sheets: Record<string, any[][]>; // sheet name -> 2D array of cell values
  sheetNames: string[];
  uploadDate: Date;
  cellStyles?: Record<string, Record<string, CellStyle>>; // sheetName -> cellRef -> style
}

// Mapping between Schema and Workbook
export interface SavedMapping {
  id: string;
  name: string;
  description: string;
  tags: string[];
  schemaId: string; // Link to Schema (clean table)
  workbookFormat?: string; // Optional: describe workbook structure
  fieldMappings: FieldMapping[];
  createdAt: Date;
  updatedAt: Date;
  // Legacy field for backward compatibility
  fields?: Omit<GlobalSchemaField, 'computedValue'>[];
}

export interface FieldMapping {
  schemaFieldId: string; // Links to SchemaField.id
  formula: string; // e.g., "=Master!B5+Master!C5", "=SUM(A1:A10)"
  cellReferences: CellReference[];
  computedValue?: any; // Computed during preview
  isValid: boolean;
  error?: string;
}

// Clean Table Record (Extracted Data)
export interface CleanTableRecord {
  id: string;
  schemaId: string;
  data: Record<string, any>; // field name -> value
  sourceWorkbook: string;
  sourceMappingId: string;
  extractedAt: Date;
}

export interface RecentUpload {
  id: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  workbookData: WorkbookData;
}

// Bulk Mapping Types (for direct column-to-field mapping)
export interface BulkMapping {
  id: string;
  name: string;
  description: string;
  tags: string[];
  schemaId: string;
  columnMappings: ColumnMapping[];
  headerRow: number; // Row number containing headers (1-based)
  startDataRow: number; // First row containing data (1-based)
  createdAt: Date;
  updatedAt: Date;
}

export interface ColumnMapping {
  schemaFieldId: string; // Links to SchemaField.id
  excelColumn: string; // Column letter (e.g., "A", "B", "C") or column name
  isValid: boolean;
  error?: string;
}
