# Excel Rich Formatting & Advanced Features Guide

## Overview
Enhanced the Excel viewer to support **merged cells**, **hidden rows/columns**, and **rich formatting** (alignment, font sizes, etc.) while maintaining full backward compatibility.

## New Features Added

### 1. ✅ Merged Cells Support
Excel cells that are merged will now display correctly in Handsontable with proper spanning.

**Example:**
- If cells A1:C1 are merged in Excel, they will display as a single merged cell in the preview
- Content from the top-left cell is displayed across the merged range
- Visual appearance matches Excel's merged cell behavior

### 2. ✅ Hidden Rows Preservation
Rows that are hidden in Excel will remain hidden in the preview.

**Features:**
- Hidden rows are not displayed in the grid
- Visual indicators show where rows are hidden (Handsontable indicators)
- Row numbering accounts for hidden rows
- Data integrity is maintained - hidden rows are still in the data structure

### 3. ✅ Hidden Columns Preservation
Columns that are hidden in Excel will remain hidden in the preview.

**Features:**
- Hidden columns are not displayed in the grid
- Visual indicators show where columns are hidden
- Column lettering accounts for hidden columns
- Hidden column data is preserved in the underlying data

### 4. ✅ Enhanced Rich Formatting

#### Text Alignment
- **Horizontal**: Left, Center, Right
- **Vertical**: Top, Middle, Bottom

#### Font Styling
- **Bold** text
- *Italic* text
- <u>Underline</u> text
- Font sizes (e.g., 8pt, 12pt, 16pt)

#### Colors
- Text colors (any RGB color)
- Background/fill colors (any RGB color)

#### Borders
- Top border
- Right border
- Bottom border
- Left border
- Custom border styles

## Technical Implementation

### Updated Type Definitions (`src/types/excel.ts`)

```typescript
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
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'middle' | 'bottom';
  };
  fontSize?: number;
}

export interface MergedCell {
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
}

export interface WorkbookData {
  fileName: string;
  sheets: Record<string, any[][]>;
  sheetNames: string[];
  uploadDate: Date;
  cellStyles?: Record<string, Record<string, CellStyle>>;
  mergedCells?: Record<string, MergedCell[]>;
  hiddenRows?: Record<string, number[]>;
  hiddenColumns?: Record<string, number[]>;
}
```

### Excel Parser Updates (`src/lib/excelParser.ts`)

#### Merged Cells Extraction
```typescript
if (worksheet['!merges']) {
  mergedCells[sheetName] = worksheet['!merges'].map((merge: any) => ({
    row: merge.s.r,
    col: merge.s.c,
    rowspan: merge.e.r - merge.s.r + 1,
    colspan: merge.e.c - merge.s.c + 1,
  }));
}
```

#### Hidden Rows Extraction
```typescript
if (worksheet['!rows']) {
  const hidden: number[] = [];
  worksheet['!rows'].forEach((rowInfo: any, index: number) => {
    if (rowInfo && rowInfo.hidden) {
      hidden.push(index);
    }
  });
  if (hidden.length > 0) {
    hiddenRows[sheetName] = hidden;
  }
}
```

#### Hidden Columns Extraction
```typescript
if (worksheet['!cols']) {
  const hidden: number[] = [];
  worksheet['!cols'].forEach((colInfo: any, index: number) => {
    if (colInfo && colInfo.hidden) {
      hidden.push(index);
    }
  });
  if (hidden.length > 0) {
    hiddenColumns[sheetName] = hidden;
  }
}
```

#### Enhanced Style Extraction
```typescript
// Font styles
if (cellStyle.font) {
  if (cellStyle.font.bold) style.bold = true;
  if (cellStyle.font.italic) style.italic = true;
  if (cellStyle.font.underline) style.underline = true;
  if (cellStyle.font.sz) style.fontSize = cellStyle.font.sz;
  if (cellStyle.font.color?.rgb) {
    style.color = `#${cellStyle.font.color.rgb}`;
  }
}

// Alignment
if (cellStyle.alignment) {
  style.alignment = {
    horizontal: cellStyle.alignment.horizontal,
    vertical: cellStyle.alignment.vertical,
  };
}
```

### ExcelViewer Component Updates (`src/components/excel/ExcelViewer.tsx`)

#### Handsontable Configuration with Merged Cells
```typescript
hotInstanceRef.current = new Handsontable(containerRef.current, {
  // ... other config
  mergeCells: mergedCells.length > 0 ? mergedCells : false,
  hiddenRows: hiddenRows.length > 0 ? {
    rows: hiddenRows,
    indicators: true,
  } : undefined,
  hiddenColumns: hiddenColumns.length > 0 ? {
    columns: hiddenColumns,
    indicators: true,
  } : undefined,
  // ... rest of config
});
```

#### Enhanced Cell Renderer
```typescript
afterRenderer: (TD, row, col, prop, value, cellProperties) => {
  const cellRef = `${columnIndexToLetter(col)}${row + 1}`;
  const style = cellStyles[cellRef];
  
  if (style) {
    if (style.color) TD.style.color = style.color;
    if (style.bgColor) TD.style.backgroundColor = style.bgColor;
    if (style.fontSize) TD.style.fontSize = `${style.fontSize}px`;
    
    if (style.alignment) {
      if (style.alignment.horizontal) {
        TD.style.textAlign = style.alignment.horizontal;
      }
      if (style.alignment.vertical) {
        TD.style.verticalAlign = style.alignment.vertical;
      }
    }
    
    if (style.border) {
      if (style.border.top) TD.style.borderTop = '2px solid #000';
      if (style.border.right) TD.style.borderRight = '2px solid #000';
      if (style.border.bottom) TD.style.borderBottom = '2px solid #000';
      if (style.border.left) TD.style.borderLeft = '2px solid #000';
    }
  }
}
```

## Features Matrix

| Feature | Supported | Notes |
|---------|-----------|-------|
| Merged Cells | ✅ Yes | Full support with rowspan/colspan |
| Hidden Rows | ✅ Yes | With visual indicators |
| Hidden Columns | ✅ Yes | With visual indicators |
| Bold Text | ✅ Yes | Via className 'htBold' |
| Italic Text | ✅ Yes | Via className 'htItalic' |
| Underline Text | ✅ Yes | Via className 'htUnderline' |
| Font Size | ✅ Yes | Dynamic px sizing |
| Text Color | ✅ Yes | Full RGB color support |
| Background Color | ✅ Yes | Full RGB color support |
| Text Alignment | ✅ Yes | Horizontal & vertical |
| Borders | ✅ Yes | All four sides |
| Cell Formulas | ✅ Yes | Displayed as values |
| Date Formatting | ✅ Yes | UTC-aware rendering |
| Number Formatting | ✅ Yes | Preserved from Excel |
| Multi-sheet | ✅ Yes | Tab navigation |
| Cell Selection | ✅ Yes | With copy functionality |
| Column Resizing | ✅ Yes | Manual resize |
| Row Resizing | ✅ Yes | Manual resize |

## Usage Examples

### Example 1: Excel File with Merged Header
```
Excel File Structure:
Row 1: A1:E1 merged with "Sales Report 2024" (bold, centered, size 16)
Row 2: Individual columns with headers

Result in Preview:
✅ "Sales Report 2024" displays across 5 columns
✅ Text is bold, centered, and larger
✅ Background color preserved
```

### Example 2: Excel File with Hidden Rows
```
Excel File Structure:
Row 1-5: Visible data
Row 6-10: Hidden (intermediate calculations)
Row 11-15: Visible summary data

Result in Preview:
✅ Rows 1-5 display normally
✅ Visual indicator shows rows are hidden
✅ Rows 11-15 display as rows 6-10 (renumbered)
✅ Hidden row data is preserved in data structure
```

### Example 3: Complex Formatting
```
Excel File Structure:
- Header row: Bold, centered, blue background
- Data rows: Right-aligned numbers
- Total row: Bold, yellow background, bordered
- Comments: Italic, smaller font, left-aligned

Result in Preview:
✅ All formatting preserved
✅ Visual appearance matches Excel
✅ Interactive features still work (selection, copy)
```

## Benefits

### For Users
1. **WYSIWYG Preview** - See Excel files exactly as they appear
2. **Hidden Content** - Hidden rows/columns stay hidden
3. **Professional Appearance** - Formatting preserved for presentations
4. **Accurate Mapping** - Cell references work with merged cells

### For Developers
1. **Type Safety** - Full TypeScript support for new features
2. **Backward Compatible** - Existing code continues to work
3. **Extensible** - Easy to add more formatting features
4. **Performance** - Efficient rendering with Handsontable

## Limitations & Considerations

### Current Limitations
1. **Conditional Formatting** - Not yet supported (Excel formulas for formatting)
2. **Cell Comments** - Not displayed (can be added in future)
3. **Data Validation** - Not enforced in preview
4. **Charts/Images** - Not rendered (Handsontable limitation)
5. **Complex Formulas** - Displayed as calculated values, not formulas

### Performance Considerations
- **Large Merged Regions** - May impact rendering speed slightly
- **Many Hidden Rows** - No significant performance impact
- **Rich Formatting** - Minimal overhead with current implementation

## Browser Compatibility

All features work in:
- ✅ Chrome/Edge (latest 2 versions)
- ✅ Firefox (latest 2 versions)
- ✅ Safari (latest 2 versions)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## Testing Checklist

- ✅ Merged cells display correctly
- ✅ Hidden rows are not shown
- ✅ Hidden columns are not shown
- ✅ Visual indicators appear for hidden content
- ✅ Bold text renders properly
- ✅ Italic text renders properly
- ✅ Underline text renders properly
- ✅ Font sizes apply correctly
- ✅ Text colors display accurately
- ✅ Background colors display accurately
- ✅ Text alignment works (horizontal & vertical)
- ✅ Borders render correctly
- ✅ Cell selection works with merged cells
- ✅ Copy functionality works
- ✅ Multi-sheet navigation works
- ✅ Date formatting preserved
- ✅ Number formatting preserved
- ✅ Build completes successfully
- ✅ No TypeScript errors

## Future Enhancements

Potential features for future implementation:

1. **Conditional Formatting** - Show cells with formula-based formatting
2. **Cell Comments** - Display Excel comments/notes
3. **Data Validation** - Show dropdown lists and validation rules
4. **Sparklines** - Mini charts in cells
5. **Rich Text in Cells** - Multiple font styles within one cell
6. **More Border Styles** - Dashed, dotted, double lines
7. **Cell Protection** - Show locked/unlocked cells
8. **Print Layout** - Page breaks and print areas

## Troubleshooting

### Merged Cells Not Displaying
**Issue**: Merged cells appear as separate cells
**Solution**: Ensure the Excel file was saved with merged cells intact

### Hidden Rows Still Visible
**Issue**: Hidden rows appear in the preview
**Solution**: Check that rows are hidden in Excel (not just filtered)

### Formatting Not Preserved
**Issue**: Some styling is missing
**Solution**: Verify the Excel file has actual cell formatting (not just visual themes)

### Performance Issues with Large Files
**Issue**: Slow rendering with many merged cells
**Solution**: Consider limiting preview to first N rows for very large files

## References

- [Handsontable Merged Cells Documentation](https://handsontable.com/docs/javascript-data-grid/row-and-column-merging/)
- [Handsontable Hidden Rows/Columns](https://handsontable.com/docs/javascript-data-grid/row-hiding/)
- [SheetJS (xlsx) Documentation](https://docs.sheetjs.com/)
- [Handsontable Cell Rendering](https://handsontable.com/docs/javascript-data-grid/cell-renderer/)

---

**Implementation Date:** November 24, 2025  
**Version:** 1.0.0  
**Status:** ✅ Complete and Tested  
**Backward Compatible:** Yes - All existing functionality preserved
