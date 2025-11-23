# Mapping JSON Import Guide

## Overview

The JSON Import feature allows you to create mappings programmatically using JSON configuration files. This is useful for:
- Bulk mapping creation
- Version control of mapping configurations
- Sharing mapping templates
- Automated mapping setup

## JSON Format

### Basic Structure

```json
{
  "name": "Your Mapping Name",
  "description": "Optional description of the mapping",
  "tags": ["tag1", "tag2"],
  "schemaId": "schema-uuid-here",
  "fieldMappings": [
    {
      "fieldName": "field1",
      "formula": "='Sheet1'!A1"
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ Yes | The name of the mapping |
| `description` | string | ❌ No | Description of what this mapping does |
| `tags` | string[] | ❌ No | Array of tags for organization |
| `schemaId` | string | ⚠️ Either this or `schemaName` | UUID of the target schema |
| `schemaName` | string | ⚠️ Either this or `schemaId` | Name of the target schema |
| `fieldMappings` | array | ✅ Yes | Array of field mapping objects |

### Field Mapping Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fieldName` | string | ✅ Yes | Schema field name (not display label) |
| `formula` | string | ✅ Yes | Excel-style formula (e.g., `='Sheet1'!A1`) |

## Examples

### Example 1: Simple Column Mapping

```json
{
  "name": "Monthly Revenue Mapping",
  "description": "Maps monthly revenue data from P&L sheet",
  "tags": ["revenue", "monthly"],
  "schemaName": "financial_data",
  "fieldMappings": [
    {
      "fieldName": "period",
      "formula": "='P&L'!A2"
    },
    {
      "fieldName": "revenue",
      "formula": "='P&L'!B2"
    },
    {
      "fieldName": "expenses",
      "formula": "='P&L'!C2"
    }
  ]
}
```

### Example 2: Formula-Based Mapping

```json
{
  "name": "Calculated Metrics Mapping",
  "description": "Uses formulas to calculate derived metrics",
  "tags": ["calculated", "metrics"],
  "schemaId": "abc-123-def-456",
  "fieldMappings": [
    {
      "fieldName": "month",
      "formula": "='Summary'!A1"
    },
    {
      "fieldName": "total_revenue",
      "formula": "=SUM('Revenue'!B2:B10)"
    },
    {
      "fieldName": "profit_margin",
      "formula": "='Summary'!C1/'Summary'!B1"
    }
  ]
}
```

### Example 3: Multi-Sheet Aggregation

```json
{
  "name": "Hotel Performance Mapping",
  "description": "Aggregates data from multiple hotel sheets",
  "tags": ["hotel", "aggregation"],
  "schemaName": "hotel_metrics",
  "fieldMappings": [
    {
      "fieldName": "date",
      "formula": "='Room Data'!A2"
    },
    {
      "fieldName": "total_rooms",
      "formula": "='Room Data'!B2"
    },
    {
      "fieldName": "occupied_rooms",
      "formula": "='Room Data'!C2"
    },
    {
      "fieldName": "room_revenue",
      "formula": "='Revenue'!D2"
    },
    {
      "fieldName": "fnb_revenue",
      "formula": "='Revenue'!E2"
    },
    {
      "fieldName": "total_revenue",
      "formula": "='Revenue'!D2+'Revenue'!E2"
    }
  ]
}
```

## Usage Steps

### Step 1: Prepare Your Schema

Before creating a JSON mapping, ensure:
1. Your schema exists in the system
2. You know the exact field names (not display labels)
3. You know the schema ID or name

**To find field names:**
1. Go to Project Config → Schemas
2. View your schema
3. Note the "name" field (not displayLabel) for each field

### Step 2: Create JSON File

Create a JSON file following the format above. You can:
- Write it manually
- Use the "Load Example" button to get started
- Copy from an existing mapping configuration

### Step 3: Validate

Before importing:
1. Paste your JSON into the import dialog
2. Click "Validate JSON"
3. Fix any errors or warnings shown

### Step 4: Import

Once validation passes:
1. Click "Import Mapping"
2. The mapping will be created with all field mappings
3. You can then apply it to your workbook data

## Common Formulas

### Cell References

```json
"formula": "='Sheet1'!A1"           // Single cell
"formula": "='Sheet Name'!B5"       // Sheet with spaces (must use quotes)
"formula": "=Sheet1!C10"            // Sheet without spaces
```

### Range Functions

```json
"formula": "=SUM('Data'!A1:A10)"    // Sum a range
"formula": "=AVERAGE('Data'!B1:B10)" // Average
"formula": "=COUNT('Data'!C1:C10)"  // Count
"formula": "=MIN('Data'!D1:D10)"    // Minimum
"formula": "=MAX('Data'!E1:E10)"    // Maximum
```

### Arithmetic Operations

```json
"formula": "='Sheet1'!A1+'Sheet1'!B1"   // Addition
"formula": "='Sheet1'!A1-'Sheet1'!B1"   // Subtraction
"formula": "='Sheet1'!A1*'Sheet1'!B1"   // Multiplication
"formula": "='Sheet1'!A1/'Sheet1'!B1"   // Division
```

### Multi-Sheet References

```json
"formula": "='Revenue'!A1+'Costs'!B1"              // Add cells from different sheets
"formula": "=SUM('Jan'!A1:A10,'Feb'!A1:A10)"      // Sum across sheets
"formula": "='Summary'!B5/'Summary'!B4"           // Calculations on same sheet
```

## Validation Rules

The JSON import validates:

### Required Fields
- ✅ `name` must be provided and non-empty
- ✅ Either `schemaId` or `schemaName` must be provided
- ✅ `fieldMappings` must be an array with at least one mapping
- ✅ Each field mapping must have `fieldName` and `formula`

### Schema Validation
- ✅ Schema must exist in the system
- ✅ All `fieldName` values must match existing schema fields
- ✅ Field names are matched by `name` property, not `displayLabel`

### Warnings (Non-Blocking)
- ⚠️ No field mappings provided
- ⚠️ Field mapping has empty formula

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "JSON Parse Error" | Invalid JSON syntax | Check for missing commas, quotes, brackets |
| "Missing required field: name" | No mapping name | Add `"name": "Your Name"` |
| "Schema not found" | Invalid schema ID/name | Verify schema exists, check spelling |
| "Field not found in schema" | Invalid field name | Check schema field names (not display labels) |
| "Missing fieldMappings array" | No mappings provided | Add `"fieldMappings": [...]` |

## Tips & Best Practices

### 1. Use Schema Names for Readability

```json
// ✅ Good - Easy to read and maintain
"schemaName": "financial_data"

// ❌ Also works but less readable
"schemaId": "550e8400-e29b-41d4-a716-446655440000"
```

### 2. Comment Your Field Names

While JSON doesn't support comments, you can add descriptive field names in your schema:

```json
{
  "fieldName": "reporting_period_start_date",
  "formula": "='Data'!A2"
}
```

### 3. Version Control

Store your JSON mapping files in version control:

```
/mappings
  /revenue-mapping-v1.json
  /expense-mapping-v1.json
  /hotel-metrics-v2.json
```

### 4. Test with Small Datasets First

Before creating complex mappings:
1. Test formulas in Excel manually
2. Create a simple mapping with 1-2 fields
3. Validate it works
4. Expand to full mapping

### 5. Use Consistent Naming

```json
{
  "name": "Revenue Mapping - Q4 2024",
  "tags": ["revenue", "q4", "2024"],
  "fieldMappings": [
    // Consistent naming: lowercase with underscores
    {"fieldName": "period_start", "formula": "..."},
    {"fieldName": "period_end", "formula": "..."},
    {"fieldName": "total_revenue", "formula": "..."}
  ]
}
```

## Troubleshooting

### Formula Not Working?

1. **Check sheet name quotes:**
   - Use quotes for sheets with spaces: `='P&L Summary'!A1`
   - No quotes for simple names: `=Sheet1!A1`

2. **Verify cell references:**
   - Ensure cells exist in the workbook
   - Check for typos in sheet names

3. **Test in Excel first:**
   - Create the formula in Excel
   - Copy the exact syntax to JSON

### Field Not Found?

1. **Check field name vs display label:**
   ```json
   // ❌ Wrong - using display label
   "fieldName": "Monthly Revenue"
   
   // ✅ Correct - using field name
   "fieldName": "monthly_revenue"
   ```

2. **Check schema:**
   - Go to Project Config → Schemas
   - Find your schema
   - Copy exact field names

### Schema Not Found?

1. **Verify schema exists:**
   - Check Project Config → Schemas
   - Ensure schema is created

2. **Check spelling:**
   ```json
   // Case-sensitive!
   "schemaName": "financial_data"  // ✅
   "schemaName": "Financial_Data"  // ❌ (if schema is lowercase)
   ```

## Integration with Workflow

### Typical Workflow

1. **Create Schema** (if not exists)
   - Define fields with correct names
   - Set field types (date, number, text, etc.)

2. **Prepare JSON Mapping**
   - Write or generate JSON configuration
   - Include all required field mappings

3. **Import Mapping**
   - Use JSON Import feature
   - Validate and fix any errors

4. **Apply to Workbook**
   - Upload Excel workbook
   - Select imported mapping
   - Preview and save data

### Automation Possibilities

Since mappings are JSON, you can:
- Generate them programmatically
- Store in configuration management
- Share across teams
- Create templates for common patterns

---

**Created**: November 24, 2025  
**Feature**: JSON Import for Mappings  
**Status**: ✅ Available
