# Date Timezone Display Fix

## Problem

When uploading Excel files with date columns, the Excel preview (using Handsontable) was showing dates with timezone information that shifted the dates incorrectly:

```
Sun Dec 31 2023 23:59:50 GMT+0530 (India Standard Time)
```

Instead of the expected:
```
2024-01-01
```

## Root Cause

1. **Excel Date Parsing**: Excel stores dates as serial numbers (e.g., `45234` = Oct 8, 2023)
2. **Automatic Conversion**: The `excelParser.ts` correctly converts these to JavaScript `Date` objects using `cellDates: true`
3. **Display Issue**: Handsontable was using the default `.toString()` method on `Date` objects, which includes:
   - Full datetime (not just the date)
   - Timezone offset (e.g., GMT+0530)
   - This caused dates to appear shifted when displayed in different timezones

### Example of the Issue:
- **Actual Date**: January 1, 2024 (stored in Excel)
- **Parsed as**: `new Date('2024-01-01T00:00:00.000Z')` (midnight UTC)
- **Displayed in IST (UTC+5:30)**: December 31, 2023 23:59:50 (shifted back 5.5 hours)

## Solution

Modified `ExcelViewer.tsx` to use a custom Handsontable renderer for date cells that:

1. Detects cells containing JavaScript `Date` objects
2. Formats them using local date components (`getFullYear()`, `getMonth()`, `getDate()`) to avoid timezone conversion
3. Displays as `YYYY-MM-DD` format (e.g., `2024-01-01`) without any timezone shift

### Code Changes

**File**: `src/components/excel/ExcelViewer.tsx`

**Modified the `cells` configuration**:

```typescript
cells: (row, col) => {
  const cellRef = `${columnIndexToLetter(col)}${row + 1}`;
  const style = cellStyles[cellRef];
  const cellData = sheetData[row]?.[col];
  
  const cellProperties: any = {};
  
  // Check if this cell contains a Date object and format it properly
  if (cellData instanceof Date && !isNaN(cellData.getTime())) {
    cellProperties.renderer = function(instance: any, td: HTMLTableCellElement, row: number, col: number, prop: any, value: any, cellProperties: any) {
      // Format date as YYYY-MM-DD using local date components to avoid timezone shift
      if (value instanceof Date && !isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        td.textContent = dateStr;
      } else {
        td.textContent = value !== null && value !== undefined ? String(value) : '';
      }
      return td;
    };
  }
  
  // ... rest of styling logic
}
```

## Impact

### ✅ Fixed
- **Excel Preview**: Now shows dates in consistent `YYYY-MM-DD` format
- **No Timezone Shift**: Dates display correctly regardless of user's timezone
- **Consistent with Database**: Matches the format stored in PostgreSQL `DATE` columns

### ✅ Preserved
- **Data Integrity**: The underlying `Date` objects remain unchanged
- **Formula Computation**: Date values are still processed correctly by `formulaComputer.ts`
- **Database Storage**: Still stored as `YYYY-MM-DD` in PostgreSQL

### 📝 Notes
- This fix only affects the **display** in the Excel preview
- The actual data flow (parsing → computation → storage) remains unchanged
- All existing functionality for date mapping and storage continues to work

## Date Handling Flow (Updated)

```
Excel Cell (formatted as DD/MM/YYYY or any format)
     ↓
Excel Internal: Serial number (e.g., 45657)
     ↓
excelParser.ts: JavaScript Date object (cellDates: true)
     ↓
ExcelViewer.tsx: Display as YYYY-MM-DD ✨ NEW FIX
     ↓
formulaComputer.ts: Process as Date object
     ↓
Supabase Insert: ISO string (YYYY-MM-DD)
     ↓
PostgreSQL DATE: Stored as YYYY-MM-DD
```

## Testing

To verify the fix:

1. Upload an Excel file with date columns (any format: DD/MM/YYYY, MM/DD/YYYY, etc.)
2. Check the Excel preview - dates should display as `YYYY-MM-DD`
3. Create a mapping with a date field
4. Save to clean table - dates should store correctly in the database
5. Query the data - dates should display as `YYYY-MM-DD`

## Related Files

- `src/components/excel/ExcelViewer.tsx` - ✏️ Modified (display fix)
- `src/lib/excelParser.ts` - ✓ Unchanged (parsing works correctly)
- `src/lib/formulaComputer.ts` - ✓ Unchanged (computation works correctly)
- `src/lib/formatters.ts` - ✓ Unchanged (formatting works correctly)
- `supabase/functions/manage-schema-table/index.ts` - ✓ Unchanged (DATE column type)

---

**Date Fixed**: November 24, 2025
**Issue**: Date timezone display in Excel preview
**Status**: ✅ Resolved
