# RevSense - Architecture & Component Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Application Architecture](#application-architecture)
3. [Core Components](#core-components)
4. [Page Components](#page-components)
5. [Context & State Management](#context--state-management)
6. [Utility Libraries](#utility-libraries)
7. [Data Flow](#data-flow)
8. [Product Features](#product-features)

---

## Project Overview

**RevSense** is a web-based Excel data mapping and consolidation platform that allows users to:
- Upload Excel workbooks (.xlsx, .xls)
- Define reusable data schemas
- Create mappings between Excel cells and schema fields
- Extract and consolidate data from multiple workbooks
- Export consolidated data in multiple formats

**Technology Stack:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Router v6 (routing)
- TanStack Query (data fetching)
- shadcn/ui components
- ExcelJS & XLSX libraries (Excel parsing)
- LocalStorage (data persistence)

---

## Application Architecture

### Entry Point
**File:** `src/main.tsx`
- Renders the root `<App />` component
- Wraps application in React StrictMode

### Root Component
**File:** `src/App.tsx`

The main application wrapper that provides:
- **QueryClientProvider**: TanStack Query client for async state management
- **TooltipProvider**: Global tooltip context
- **ExcelProvider**: Custom context for Excel data management (see `src/contexts/ExcelContext.tsx`)
- **Toaster & Sonner**: Toast notification systems
- **BrowserRouter**: React Router for navigation

#### Route Structure
```
/ (root)                    → SignUp page
/dashboard                  → Dashboard layout (authenticated area)
  ├── /project-config       → Schema & mapping management (default)
  ├── /add-data             → Upload & map Excel files
  └── /consolidated-data    → View consolidated data tables
* (catch-all)               → NotFound page
```

---

## Core Components

### Layout Components

#### 1. **Dashboard** (`src/pages/Dashboard.tsx`)
Main layout wrapper for authenticated pages.

**State:**
- `isChatOpen: boolean` - Controls AI chat pane visibility

**Structure:**
```tsx
<TopNavbar /> (fixed header with branding & controls)
<div className="flex">
  <LeftNavbar />     (side navigation)
  <main />           (page content via <Outlet />)
  {isChatOpen && <RightChatPane />} (AI assistant)
</div>
```

**Functions:**
- `onAskAIClick()` - Opens the AI chat pane

---

#### 2. **TopNavbar** (`src/components/layout/TopNavbar.tsx`)
Top navigation bar with branding and user controls.

**Props:**
- `onAskAIClick?: () => void` - Callback to open AI chat

**Features:**
- RevSense branding with Sparkles icon
- "Ask AI" button (triggers `onAskAIClick`)
- User avatar dropdown menu
  - Settings
  - Profile
  - Log out

**Icons Used:** `Sparkles`, `MessageSquare`, `Settings`, `User`

---

#### 3. **LeftNavbar** (`src/components/layout/LeftNavbar.tsx`)
Primary navigation sidebar for switching between dashboard sections.

**Navigation Items:**
- Project Config (default)
- Add Data
- Consolidated Data

Uses `react-router-dom`'s `NavLink` for active state styling.

---

#### 4. **RightChatPane** (`src/components/layout/RightChatPane.tsx`)
AI assistant chat interface (slide-in panel).

**Props:**
- `isOpen: boolean` - Visibility state
- `onClose: () => void` - Callback to close pane

**State:**
- `messages: Message[]` - Chat message history
- `input: string` - Current user input

**Message Interface:**
```typescript
interface Message {
  id: number;
  text: string;
  isUser: boolean;
  hasTable?: boolean;  // Shows "View Table" button
  hasGraph?: boolean;  // Shows "View Graph" button
}
```

**Features:**
- Slide-in animation from right (`animate-slide-in-right`)
- Message history with user/AI differentiation
- Input field with Enter-to-send
- Clear chat history button
- Close button
- Mock responses (placeholder for AI integration)

**Functions:**
- `handleSend()` - Sends user message and generates mock AI response

---

#### 5. **SecondaryTabs** (`src/components/layout/SecondaryTabs.tsx`)
Tab navigation for sub-sections within pages.

**Props:**
- `tabs: string[]` - Tab labels
- `activeTab: string` - Currently active tab
- `onTabChange: (tab: string) => void` - Tab selection callback

Used in ProjectConfig for "Schemas", "Mappings", "Business Logic" tabs.

---

### Excel Components

#### 6. **ExcelViewer** (`src/components/excel/ExcelViewer.tsx`)
Displays Excel workbook data in an interactive spreadsheet view.

**Uses:** 
- `useExcel()` hook to access `workbookData`, `selectedSheet`, `setSelectedSheet`
- Handsontable library for spreadsheet rendering

**Features:**
- Sheet tabs for multi-sheet workbooks
- Interactive cell selection
- Read-only view of Excel data

---

#### 7. **FormulaBar** (`src/components/excel/FormulaBar.tsx`)
Displays and allows editing of Excel-style formulas.

**Props:**
- `value: string` - Current formula
- `onChange: (value: string) => void` - Formula update callback
- `onSubmit: () => void` - Submit formula

Similar to Excel's formula bar for entering cell references and formulas.

---

#### 8. **GlobalSchemaForm** (`src/components/excel/GlobalSchemaForm.tsx`)
Legacy component for defining global schema fields.

**Note:** This component is being phased out in favor of the new Schema system.

---

### Schema Components

#### 9. **SchemaDefinitionForm** (`src/components/schema/SchemaDefinitionForm.tsx`)
Dialog form for creating/editing schemas.

**Props:**
- `open: boolean` - Dialog visibility
- `onOpenChange: (open: boolean) => void` - Dialog state callback
- `schema: Schema | null` - Existing schema (edit mode) or null (create mode)
- `onSave: (schema: Schema) => void` - Save callback

**Schema Interface:**
```typescript
interface Schema {
  id: string;
  name: string;
  description: string;
  fields: SchemaField[];
  createdAt: number;
  updatedAt: number;
}

interface SchemaField {
  id: string;
  name: string;           // Internal field name
  displayLabel: string;   // User-facing label
  type: 'text' | 'number' | 'date' | 'boolean';
  required: boolean;
}
```

**Features:**
- Schema metadata editing (name, description)
- Dynamic field management (add/remove fields)
- Field configuration (name, label, type, required)
- Validation before save

---

#### 10. **SchemaFieldEditor** (`src/components/schema/SchemaFieldEditor.tsx`)
Individual field editor within schema definition.

**Props:**
- `field: SchemaField` - Field data
- `onChange: (updates: Partial<SchemaField>) => void` - Field update callback
- `onRemove: () => void` - Field removal callback

**Controls:**
- Field name input
- Display label input
- Type selector (text/number/date/boolean)
- Required checkbox
- Remove button

---

#### 11. **SchemaList** (`src/components/schema/SchemaList.tsx`)
Displays all created schemas in a grid.

**Props:**
- `schemas: Schema[]` - Array of schemas
- `onEdit: (schema: Schema) => void` - Edit callback
- `onDelete: (id: string) => void` - Delete callback

**Features:**
- Card-based schema display
- Shows schema metadata (name, description, field count)
- Edit/Delete actions per schema

---

### Mapping Components

#### 12. **MappingCreationPane** (`src/components/mapping/MappingCreationPane.tsx`)
Right sidebar panel for creating new field mappings.

**Props:**
- `schemas: Schema[]` - Available schemas
- `workbookData: WorkbookData` - Current workbook
- `onSave: (name, description, tags, schemaId, mappings) => void` - Save callback

**Features:**
- Schema selection dropdown
- Mapping metadata inputs (name, description, tags)
- Field mapping rows for each schema field
- Cell selection from Excel viewer
- Save button

**Functions:**
- Manages field mappings for selected schema
- Validates all fields are mapped before save
- Creates `FieldMapping[]` array

---

#### 13. **MappingApplicationPane** (`src/components/mapping/MappingApplicationPane.tsx`)
Applies an existing mapping to a workbook and extracts data.

**Props:**
- `mapping: SavedMapping` - Selected mapping
- `schema: Schema | null` - Associated schema
- `workbookData: WorkbookData` - Current workbook
- `onSaveToCleanTable: (data: Record<string, any>) => void` - Save callback
- `onClose: () => void` - Close callback

**Process:**
1. Reads mapping configuration
2. Extracts values from workbook cells
3. Applies formulas/transformations
4. Displays preview of extracted data
5. Saves to clean table on confirmation

**Functions:**
- `extractData()` - Extracts data based on field mappings
- `handleSave()` - Saves extracted data to clean table

---

#### 14. **FieldMappingRow** (`src/components/mapping/FieldMappingRow.tsx`)
Individual row for mapping a schema field to Excel cells.

**Props:**
- `field: SchemaField` - Schema field to map
- `mapping: FieldMapping` - Current mapping state
- `onMappingChange: (mapping: FieldMapping) => void` - Update callback
- `workbookData: WorkbookData` - For cell reference validation

**Features:**
- Field info display (name, type)
- Cell reference input (e.g., "Sheet1!A1", "Sheet1!B2:B10")
- Formula input (optional transformations)
- Visual feedback for required fields
- Cell selection mode button

---

## Page Components

### 15. **SignUp** (`src/pages/SignUp.tsx`)
Landing/authentication page.

**Features:**
- User registration form (placeholder)
- Redirects to dashboard after signup

---

### 16. **ProjectConfig** (`src/pages/ProjectConfig.tsx`)
Central configuration hub for schemas, mappings, and business logic.

**State:**
- `activeTab: string` - Current tab ("Schemas" | "Mappings" | "Business Logic")
- `schemaDialogOpen: boolean` - Schema form dialog state
- `editingSchema: Schema | null` - Schema being edited

**Uses:**
- `useExcel()` hook for schema/mapping CRUD operations
- `SecondaryTabs` for tab navigation

#### Tab: Schemas
**Functions:**
- `handleCreateSchema()` - Opens schema form in create mode
- `handleEditSchema(schema)` - Opens schema form in edit mode
- `handleSaveSchema(schema)` - Saves new or updated schema via `createSchema()` or `updateSchemaById()`
- `handleDeleteSchema(id)` - Deletes schema with confirmation via `deleteSchemaById()`

**Features:**
- Grid display of all schemas (`SchemaList` component)
- Create schema button
- Schema CRUD operations

#### Tab: Mappings
**Functions:**
- `handleCreateNewMapping()` - Navigates to `/dashboard/add-data`
- `handleLoadMapping(id)` - Loads mapping and navigates to add-data page

**Features:**
- Displays mappings grouped by schema
- Shows mapping metadata (name, description, tags, field count, date)
- Click-to-load mapping functionality
- Legacy mappings section (mappings without schema)

#### Tab: Business Logic
**Features:**
- Placeholder for future business rule definitions
- Form inputs for rule name and logic definition

---

### 17. **AddData** (`src/pages/AddData.tsx`)
Page for uploading Excel files and creating/applying mappings.

**State:**
- `selectedMappingId: string` - Currently selected mapping to apply

**Uses:**
- `useExcel()` hook for file upload and mapping operations
- `ExcelViewer` for workbook display
- `MappingCreationPane` for new mappings
- `MappingApplicationPane` for applying existing mappings

**Functions:**
- `handleFileSelect(event)` - Handles file input change, calls `uploadWorkbook(file)`
- `handleSaveMapping()` - Saves new mapping via `saveMappingNew()`
- `handleApplyMapping()` - Applies selected mapping and saves to clean table

**Layout:**
- Left: File upload + Excel viewer + recent uploads
- Right: Mapping pane (creation or application based on `selectedMappingId`)

**Flow:**
1. User uploads Excel file
2. File is parsed via `parseExcelFile()` (see `src/lib/excelParser.ts`)
3. User either:
   - Creates new mapping (select schema, map fields, save)
   - Applies existing mapping (select mapping, preview data, save to clean table)

---

### 18. **ConsolidatedData** (`src/pages/ConsolidatedData.tsx`)
View and export consolidated data tables.

**State:**
- `selectedSchemaId: string` - Currently selected schema/table

**Uses:**
- `useExcel()` hook for clean table operations

**Functions:**
- `handleExport(format)` - Exports data as JSON or CSV via `exportCleanTableData()`
- `handleDeleteRecord(recordId)` - Deletes single record via `deleteCleanTableRecord()`
- `handleClearTable()` - Clears entire table via `clearCleanTableData()`

**Features:**
- Schema selector dropdown
- Data table display with all schema fields
- Record metadata (source workbook, extraction timestamp)
- Export buttons (CSV, JSON)
- Delete record actions
- Clear all records button

**Table Structure:**
| Source Workbook | Extracted At | Field 1 | Field 2 | ... | Actions |
|-----------------|--------------|---------|---------|-----|---------|

---

### 19. **NotFound** (`src/pages/NotFound.tsx`)
404 error page for invalid routes.

---

### 20. **Index** (`src/pages/Index.tsx`)
Fallback landing page (currently unused, redirects from `/` to `/dashboard`).

---

## Context & State Management

### ExcelContext (`src/contexts/ExcelContext.tsx`)

Central state management for Excel data, schemas, mappings, and clean tables.

**Provider:** `<ExcelProvider>`  
**Hook:** `useExcel()`

#### State Variables
```typescript
workbookData: WorkbookData | null        // Current uploaded workbook
schemaFields: GlobalSchemaField[]        // Legacy schema fields
selectionMode: string | null             // Active field for cell selection
selectedSheet: string                    // Active sheet name
isUploading: boolean                     // Upload progress indicator
recentUploads: RecentUpload[]           // Recent file uploads
savedMappings: SavedMapping[]           // All saved mappings
schemas: Schema[]                       // All schemas
```

#### Schema Management Functions
```typescript
createSchema(schema: Schema): void
  → Calls saveSchema() from schemaStorage.ts
  → Refreshes schemas
  → Shows toast notification

updateSchemaById(id: string, updates: Partial<Schema>): void
  → Calls updateSchema() from schemaStorage.ts
  → Refreshes schemas

deleteSchemaById(id: string): void
  → Calls deleteSchema() from schemaStorage.ts
  → Refreshes schemas

getSchema(id: string): Schema | null
  → Calls getSchemaById() from schemaStorage.ts

refreshSchemas(): void
  → Calls getAllSchemas() from schemaStorage.ts
  → Updates schemas state
```

#### Mapping Management Functions
```typescript
saveMappingNew(name, description, tags, schemaId, fieldMappings): void
  → Calls saveMappingToStorage() from mappingStorage.ts
  → Refreshes mappings
  → Shows toast notification

getMappingsForSchema(schemaId: string): SavedMapping[]
  → Calls getMappingsBySchema() from mappingStorage.ts

loadMapping(id: string): void
  → Loads legacy mapping from storage
  → Sets schemaFields state

refreshMappings(): void
  → Calls getAllMappings() from mappingStorage.ts
  → Updates savedMappings state
```

#### Clean Table Functions
```typescript
saveDataToCleanTable(schemaId, data, workbookName, mappingId): void
  → Calls saveToCleanTable() from cleanTableStorage.ts
  → Shows toast notification

getCleanTable(schemaId: string): CleanTableRecord[]
  → Calls getCleanTableData() from cleanTableStorage.ts

deleteCleanTableRecord(schemaId: string, recordId: string): void
  → Calls deleteRecord() from cleanTableStorage.ts

clearCleanTableData(schemaId: string): void
  → Calls clearCleanTable() from cleanTableStorage.ts

exportCleanTableData(schemaId: string, format: 'json' | 'csv'): string
  → Calls exportCleanTable() from cleanTableStorage.ts
  → Returns formatted data string
```

#### Workbook Management Functions
```typescript
uploadWorkbook(file: File): Promise<void>
  → Calls parseExcelFile() from excelParser.ts
  → Sets workbookData and selectedSheet
  → Adds to recentUploads
  → Shows toast notification

loadRecentUpload(upload: RecentUpload): void
  → Loads workbook data from recent upload
  → Sets workbookData and selectedSheet
```

#### Legacy Field Functions (deprecated)
```typescript
addSchemaField(): void
removeSchemaField(id: string): void
updateField(id: string, updates: Partial<GlobalSchemaField>): void
startCellSelection(fieldId: string): void
stopCellSelection(): void
selectCells(cells: CellReference[]): void
computeFieldValue(fieldId: string): void
computeAllFields(): void
saveMapping(name: string): void
addFieldFromFormula(formula: string, name?: string): void
```

---

## Utility Libraries

### 1. **excelParser.ts** (`src/lib/excelParser.ts`)
Parses Excel files and converts to JSON structure.

**Main Function:**
```typescript
parseExcelFile(file: File): Promise<WorkbookData>
```

**Uses:**
- ExcelJS library for .xlsx parsing
- XLSX library for .xls parsing

**Returns:**
```typescript
interface WorkbookData {
  fileName: string;
  sheets: Record<string, SheetData>;
  sheetNames: string[];
}

interface SheetData {
  data: CellValue[][];      // 2D array of cell values
  formulas?: string[][];    // Cell formulas
  styles?: CellStyle[][];   // Cell formatting
}
```

**Process:**
1. Read file as ArrayBuffer
2. Parse with ExcelJS
3. Extract sheets, cells, formulas, styles
4. Convert to JSON structure

---

### 2. **formulaComputer.ts** (`src/lib/formulaComputer.ts`)
Computes values from Excel-style formulas.

**Main Functions:**
```typescript
computeFormula(
  formula: string,
  cellRefs: CellReference[],
  workbookData: WorkbookData
): any

parseExcelFormula(
  formula: string,
  defaultSheet: string
): { cellRefs: CellReference[], operation: string }
```

**Supported Operations:**
- `SUM(A1:A10)` - Sum of range
- `AVERAGE(B1:B5)` - Average of range
- `CONCAT(C1, C2)` - Concatenation
- `A1 + B1` - Addition
- `A1 - B1` - Subtraction
- `A1 * B1` - Multiplication
- `A1 / B1` - Division
- Direct cell references (returns cell value)

**CellReference Interface:**
```typescript
interface CellReference {
  sheet: string;
  cell: string;    // e.g., "A1"
  range?: string;  // e.g., "A1:A10"
}
```

**Process:**
1. Parse formula to extract cell references
2. Retrieve cell values from workbookData
3. Apply operation (SUM, AVERAGE, etc.)
4. Return computed value

---

### 3. **schemaStorage.ts** (`src/lib/schemaStorage.ts`)
LocalStorage-based schema persistence.

**Functions:**
```typescript
saveSchema(schema: Schema): void
  → Saves to localStorage key: 'revsense_schemas'

getSchemaById(id: string): Schema | null
  → Retrieves single schema

getAllSchemas(): Schema[]
  → Retrieves all schemas

updateSchema(id: string, updates: Partial<Schema>): void
  → Updates existing schema

deleteSchema(id: string): void
  → Removes schema from storage
```

**Storage Key:** `'revsense_schemas'`  
**Storage Format:** JSON stringified array of schemas

---

### 4. **mappingStorage.ts** (`src/lib/mappingStorage.ts`)
LocalStorage-based mapping persistence.

**Functions:**
```typescript
saveMappingToStorage(name, description, tags, schemaId, fieldMappings): void
  → Saves new mapping
  → Auto-generates ID and timestamps

loadMappingFromStorage(id: string): SavedMapping | null
  → Loads single mapping

getAllMappings(): SavedMapping[]
  → Loads all mappings

getMappingsBySchema(schemaId: string): SavedMapping[]
  → Filters mappings by schema ID

saveMappingToStorageLegacy(name, fields): void
  → Legacy function for old mapping format
```

**SavedMapping Interface:**
```typescript
interface SavedMapping {
  id: string;
  name: string;
  description: string;
  tags: string[];
  schemaId: string;
  fieldMappings: FieldMapping[];
  createdAt: number;
  updatedAt: number;
}

interface FieldMapping {
  fieldId: string;         // Schema field ID
  cellReferences: string[]; // e.g., ["Sheet1!A1", "Sheet1!B2:B5"]
  formula?: string;         // Optional transformation
}
```

**Storage Key:** `'revsense_mappings'`

---

### 5. **cleanTableStorage.ts** (`src/lib/cleanTableStorage.ts`)
LocalStorage-based clean table data persistence.

**Functions:**
```typescript
saveToCleanTable(schemaId, data, workbookName, mappingId): void
  → Saves extracted data record
  → Auto-generates record ID and timestamp

getCleanTableData(schemaId: string): CleanTableRecord[]
  → Gets all records for schema

getAllCleanTables(): Record<string, CleanTableRecord[]>
  → Gets all tables

deleteRecord(schemaId, recordId): void
  → Removes single record

clearCleanTable(schemaId): void
  → Removes all records from table

exportCleanTable(schemaId, format): string
  → Exports as JSON or CSV string
```

**CleanTableRecord Interface:**
```typescript
interface CleanTableRecord {
  id: string;
  schemaId: string;
  sourceWorkbook: string;
  mappingId: string;
  data: Record<string, any>;  // Field name → value
  extractedAt: number;        // Timestamp
}
```

**Storage Key:** `'revsense_clean_tables'`  
**Storage Format:** 
```json
{
  "schema_id_1": [record1, record2, ...],
  "schema_id_2": [record1, record2, ...],
}
```

---

### 6. **utils.ts** (`src/lib/utils.ts`)
Utility functions for class names and common operations.

**Main Function:**
```typescript
cn(...inputs: ClassValue[]): string
  → Merges Tailwind classes using clsx and tailwind-merge
  → Handles conditional classes
```

**Usage:**
```tsx
<div className={cn("base-class", isActive && "active-class")} />
```

---

## Data Flow

### 1. Schema Creation Flow
```
User (ProjectConfig) 
  → Click "Create Schema"
  → SchemaDefinitionForm opens
  → User fills name, description, adds fields
  → Click "Save"
  → createSchema(schema)
    → saveSchema() [schemaStorage.ts]
      → localStorage['revsense_schemas']
    → refreshSchemas()
      → Updates context state
  → Toast notification
```

### 2. Mapping Creation Flow
```
User (AddData)
  → Upload Excel file
    → uploadWorkbook(file)
      → parseExcelFile() [excelParser.ts]
        → Returns WorkbookData
      → Sets workbookData state
  → ExcelViewer displays data
  → MappingCreationPane opens
  → User selects schema
  → User maps each field to cells
    → FieldMappingRow for each field
    → User enters cell reference (e.g., "Sheet1!A1")
    → Or clicks "Select Cells" button
  → User enters mapping metadata
  → Click "Save Mapping"
    → saveMappingNew()
      → saveMappingToStorage() [mappingStorage.ts]
        → localStorage['revsense_mappings']
      → refreshMappings()
  → Toast notification
```

### 3. Data Extraction Flow
```
User (AddData)
  → Upload Excel file (workbookData loaded)
  → Select existing mapping from dropdown
  → MappingApplicationPane opens
  → System extracts data:
    → For each field mapping:
      → Get cell references
      → Extract values from workbookData.sheets[sheet].data
      → Apply formula if present
        → computeFormula() [formulaComputer.ts]
      → Store in data object
  → Preview shows extracted data
  → Click "Save to Clean Table"
    → saveDataToCleanTable()
      → saveToCleanTable() [cleanTableStorage.ts]
        → localStorage['revsense_clean_tables']
  → Toast notification
  → Navigate to ConsolidatedData
```

### 4. Data Export Flow
```
User (ConsolidatedData)
  → Select schema from dropdown
  → Click "Export CSV" or "Export JSON"
    → handleExport(format)
      → exportCleanTableData(schemaId, format)
        → exportCleanTable() [cleanTableStorage.ts]
          → Formats data as JSON or CSV string
        → Returns formatted string
      → Creates Blob
      → Downloads file
  → Toast notification
```

---

## Product Features

### 1. Schema Management
**Purpose:** Define reusable data structures for extracted data

**Features:**
- Create custom schemas with multiple fields
- Field types: text, number, date, boolean
- Required field validation
- Edit existing schemas
- Delete schemas (with confirmation)
- View all schemas in grid layout

**Use Case:** 
Create a "Sales Invoice" schema with fields:
- Invoice Number (text, required)
- Date (date, required)
- Customer Name (text, required)
- Total Amount (number, required)
- Paid Status (boolean)

---

### 2. Excel Upload & Parsing
**Purpose:** Import data from Excel workbooks

**Features:**
- Upload .xlsx and .xls files
- Multi-sheet workbook support
- Cell value extraction
- Formula preservation
- Recent uploads history
- Interactive spreadsheet viewer

**Supported:** ExcelJS, XLSX libraries

---

### 3. Field Mapping
**Purpose:** Map Excel cells to schema fields

**Features:**
- Visual cell reference input
- Range selection (e.g., "A1:A10")
- Cross-sheet references (e.g., "Sheet2!B5")
- Formula support (SUM, AVERAGE, CONCAT, etc.)
- Cell selection mode (click-to-select)
- Required field indicators

**Mapping Types:**
- Direct cell reference: `Sheet1!A1`
- Range: `Sheet1!A1:A10`
- Formula: `SUM(Sheet1!B1:B10)`
- Concatenation: `CONCAT(Sheet1!A1, " - ", Sheet1!B1)`

---

### 4. Data Extraction
**Purpose:** Extract structured data from workbooks using mappings

**Process:**
1. Select existing mapping
2. System applies mapping to workbook
3. Extracts values for each field
4. Applies formulas/transformations
5. Validates data types
6. Saves to clean table

**Features:**
- Preview extracted data before saving
- Automatic type conversion
- Formula computation
- Source tracking (which workbook, when extracted)

---

### 5. Clean Table Management
**Purpose:** Store and manage extracted data

**Features:**
- Schema-based tables
- Record management (view, delete)
- Bulk operations (clear table)
- Source tracking (workbook, mapping, timestamp)
- Data validation

**Storage:** LocalStorage (persists across sessions)

---

### 6. Data Export
**Purpose:** Export consolidated data for external use

**Formats:**
- **JSON:** Structured data with field names
- **CSV:** Spreadsheet-compatible format

**Features:**
- Schema-based export
- All records included
- Field headers
- Type-aware formatting

---

### 7. AI Assistant
**Purpose:** Help users with data analysis (placeholder)

**Features:**
- Chat interface
- Message history
- Clear history
- Slide-in panel
- Mock responses (future: real AI integration)

**Future Enhancements:**
- Data analysis queries
- Automatic mapping suggestions
- Data quality checks
- Natural language formula creation

---

### 8. Business Logic (Planned)
**Purpose:** Define custom transformation rules

**Status:** Placeholder UI (not implemented)

**Planned Features:**
- Custom validation rules
- Data transformation pipelines
- Conditional logic
- Calculated fields
- Triggers and automations

---

## Design System

### Color Tokens
Defined in `src/index.css` using CSS variables:
- `--primary` - Primary brand color
- `--secondary` - Secondary brand color
- `--accent` - Accent color
- `--background` - Page background
- `--foreground` - Text color
- `--card` - Card background
- `--muted` - Muted text/background
- `--destructive` - Error/delete actions

### Component Library
**shadcn/ui components** (customizable, accessible):
- Button, Card, Input, Select
- Dialog, Dropdown, Popover
- Table, Tabs, Toast
- Badge, Avatar, Progress
- And 40+ more components

---

## File Structure Summary

```
src/
├── components/
│   ├── excel/           # Excel viewer, formula bar
│   ├── layout/          # Navigation, chat pane
│   ├── mapping/         # Mapping creation/application
│   ├── schema/          # Schema management
│   └── ui/              # shadcn/ui components (40+ components)
├── contexts/
│   └── ExcelContext.tsx # Central state management
├── hooks/
│   ├── use-toast.ts     # Toast notifications
│   └── use-mobile.tsx   # Responsive breakpoints
├── lib/
│   ├── excelParser.ts   # Excel file parsing
│   ├── formulaComputer.ts # Formula evaluation
│   ├── schemaStorage.ts   # Schema persistence
│   ├── mappingStorage.ts  # Mapping persistence
│   ├── cleanTableStorage.ts # Clean table persistence
│   └── utils.ts           # Utilities
├── pages/
│   ├── SignUp.tsx        # Landing page
│   ├── Dashboard.tsx     # Main layout
│   ├── ProjectConfig.tsx # Schema/mapping config
│   ├── AddData.tsx       # Upload & mapping
│   ├── ConsolidatedData.tsx # View extracted data
│   └── NotFound.tsx      # 404 page
├── types/
│   └── excel.ts          # TypeScript interfaces
├── App.tsx              # Root component
└── main.tsx             # Entry point
```

---

## Key Technologies

- **React Router v6:** Client-side routing with nested routes
- **TanStack Query:** Async state management (currently minimal usage)
- **ExcelJS & XLSX:** Excel file parsing
- **Handsontable:** Spreadsheet viewer (ExcelViewer component)
- **shadcn/ui:** Pre-built, accessible UI components
- **Tailwind CSS:** Utility-first styling
- **LocalStorage:** Data persistence (schemas, mappings, clean tables)
- **TypeScript:** Type safety

---

## Future Enhancements

1. **Backend Integration**
   - Replace LocalStorage with database (Supabase/PostgreSQL)
   - User authentication
   - Multi-user collaboration

2. **AI Integration**
   - Real AI assistant (replace mock responses)
   - Auto-mapping suggestions
   - Data quality analysis
   - Natural language queries

3. **Advanced Features**
   - Business logic engine
   - Data validation rules
   - Scheduled data extraction
   - API integrations
   - Real-time collaboration

4. **Data Processing**
   - Large file handling (streaming)
   - Background processing
   - Batch operations
   - Data versioning

---

## Development Notes

### State Management Strategy
- **Local State:** Component-specific UI state (dialogs, inputs)
- **Context State:** Shared application state (workbooks, schemas, mappings)
- **LocalStorage:** Persistent data (schemas, mappings, clean tables)

### Performance Considerations
- Large Excel files may cause performance issues (consider pagination)
- LocalStorage has size limits (~5-10MB)
- Consider moving to backend for production use

### Code Quality
- TypeScript for type safety
- Component-based architecture
- Separation of concerns (UI, logic, storage)
- Reusable hooks and utilities

---

## Getting Started (Developer Guide)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Key files to understand:**
   - `src/contexts/ExcelContext.tsx` - Central state
   - `src/lib/excelParser.ts` - Excel parsing logic
   - `src/pages/AddData.tsx` - Main mapping workflow
   - `src/types/excel.ts` - TypeScript interfaces

5. **Adding new features:**
   - Create components in `/components`
   - Add storage functions in `/lib`
   - Update context if global state needed
   - Add routes in `App.tsx`

---

## Contact & Support

For questions about architecture or implementation details, refer to this documentation or explore the codebase with the component references provided above.
