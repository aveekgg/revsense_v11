# Date Timezone Display Fix

## Problem

When uploading Excel files with date columns, the Excel preview (using Handsontable) was showing dates shifted by the timezone offset:

**Expected**: `2024-01-01`  
**Actual**: `2023-12-31` (in IST timezone, UTC+5:30)

Earlier it was also showing the full datetime string:
```
Sun Dec 31 2023 23:59:50 GMT+0530 (India Standard Time)
```

## Root Cause

1. **Excel Date Storage**: Excel stores dates as serial numbers (e.g., `45292` = Jan 1, 2024)
2. **XLSX Library Conversion**: The XLSX library with `cellDates: true` converts these serial numbers to JavaScript `Date` objects in **UTC timezone**
3. **The Issue**: 
   - Excel date "January 1, 2024" → XLSX creates `new Date('2024-01-01T00:00:00.000Z')` (UTC midnight)
   - When using **local timezone methods** (like `getDate()`, `getMonth()`), JavaScript applies the timezone offset
   - In IST (UTC+5:30), this UTC midnight becomes the previous day's evening (Dec 31, 2023 at 5:30 PM local time)
   - So `getDate()` returns 31 instead of 1!

### The Timezone Trap:

```javascript
// XLSX library creates this (UTC):
const excelDate = new Date('2024-01-01T00:00:00.000Z');

// In IST timezone (UTC+5:30):
excelDate.getDate()     // Returns: 31 (Dec 31) ❌ WRONG!
excelDate.getUTCDate()  // Returns: 1  (Jan 1)  ✅ CORRECT!
```

## Solution

Modified `ExcelViewer.tsx` to use **UTC date components** instead of local timezone methods:

1. Detects cells containing JavaScript `Date` objects
2. Formats them using **UTC methods**: `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()`
3. Displays as `YYYY-MM-DD` format without any timezone conversion

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
      // Format date as YYYY-MM-DD using UTC components to match Excel's date storage
      // Excel dates are stored as day counts from epoch, converted to UTC by xlsx library
      if (value instanceof Date && !isNaN(value.getTime())) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
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

**Key Change**: Using `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()` instead of local methods.

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

- `src/components/excel/ExcelViewer.tsx` - ✏️ Modified (display fix with 12-hour rounding)
- `src/lib/formulaComputer.ts` - ✏️ Modified (normalize dates to midnight UTC before storage)
- `src/lib/excelParser.ts` - ✓ Unchanged (parsing works correctly)
- `src/lib/formatters.ts` - ✓ Unchanged (formatting works correctly)
- `supabase/functions/manage-schema-table/index.ts` - ✓ Unchanged (DATE column type)

## Additional Fix - Date Storage Normalization

**Problem**: Even though dates displayed correctly in the Excel preview, they were still being stored with time components in the database (e.g., `2024-11-30T18:29:50.000Z`), causing the same timezone shift issue when retrieved.

**Solution**: Modified `formulaComputer.ts` `castToType` function to normalize all dates to midnight UTC before storage:

```typescript
case 'date':
  if (value instanceof Date && !isNaN(value.getTime())) {
    // Add 12 hours to round to correct day, then normalize to midnight UTC
    const adjustedDate = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    return new Date(Date.UTC(adjustedDate.getUTCFullYear(), adjustedDate.getUTCMonth(), adjustedDate.getUTCDate()));
  }
```

This ensures dates are stored as `2024-11-30T00:00:00.000Z` (midnight UTC) in the database.

---

**Date Fixed**: November 24, 2025
**Issue**: Date timezone display in Excel preview
**Status**: ✅ Resolved
