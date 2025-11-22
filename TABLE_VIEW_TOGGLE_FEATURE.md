# Table View Toggle Feature

## Overview
Added a smart toggle to switch between **Pivot View** and **Long View** for canonical data tables, with intelligent defaults based on column count.

## Feature Details

### Smart Default Logic
- **6 columns or fewer**: Defaults to **Pivot View** (wide format, easier to compare)
- **More than 6 columns**: Defaults to **Long View** (canonical format, prevents horizontal scrolling)

### Toggle UI
- **Location**: Top-right corner above the table, inside the chat message block
- **Style**: Compact toggle group with icons
- **Options**:
  - **Pivot** (Grid icon): Shows data in wide format with entities/metrics as columns
  - **Long** (List icon): Shows raw canonical format (7 columns fixed)

### Column Count Calculation
```typescript
entities × metrics + 1 = total columns

Example 1 (ORR & RAAYA, Revenue & Occupancy):
2 entities × 2 metrics + 1 = 5 columns → Pivot View default

Example 2 (5 hotels, 3 metrics):
5 entities × 3 metrics + 1 = 16 columns → Long View default
```

## Visual Examples

### Pivot View (Default for ≤6 columns)
```
| Period | ORR - Revenue | ORR - Occupancy % | RAAYA - Revenue | RAAYA - Occupancy % |
|--------|--------------|-------------------|-----------------|---------------------|
| May-25 | $4,052,213   | 85.5%            | $177,604        | 72.3%              |
| Jun-25 | $4,234,567   | 88.2%            | $185,432        | 75.1%              |
```
**Total: 5 columns** → Easy to compare side-by-side

### Long View (Default for >6 columns)
```
| period     | period_grain | entity_name | metric_name    | metric_label      | metric_type | metric_value |
|------------|--------------|-------------|----------------|-------------------|-------------|--------------|
| 2025-05-01 | month        | ORR Hotel   | total_revenue  | Total Revenue     | absolute    | 4052213      |
| 2025-05-01 | month        | ORR Hotel   | occupancy_pct  | Occupancy %       | percentage  | 85.5         |
| 2025-05-01 | month        | RAAYA       | total_revenue  | Total Revenue     | absolute    | 177604       |
| 2025-05-01 | month        | RAAYA       | occupancy_pct  | Occupancy %       | percentage  | 72.3         |
```
**Always 7 columns** → No horizontal scroll for complex queries

## Implementation

### Files Modified
1. **`src/components/chat/ChatMessage.tsx`**
   - Added `useMemo` for column count calculation
   - Added `tableViewMode` state with smart default
   - Added toggle UI above table
   - Imports: `List` and `Grid3x3` icons from lucide-react

2. **`src/components/query-results/CanonicalDataTable.tsx`**
   - Updated to handle both viewMode='pivot' and viewMode='long'
   - Added contextual info row for both modes
   - Shows row count in long view vs period×metric count in pivot view

### Code Snippet (Toggle UI)
```tsx
{isCanonicalFormat && (
  <div className="flex justify-end mb-2">
    <div className="inline-flex items-center gap-1 rounded-md border bg-muted p-1">
      <Button
        variant={tableViewMode === 'pivot' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setTableViewMode('pivot')}
        title="Pivot view - metrics as columns"
      >
        <Grid3x3 className="h-3.5 w-3.5 mr-1" />
        Pivot
      </Button>
      <Button
        variant={tableViewMode === 'long' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setTableViewMode('long')}
        title="Long view - canonical format"
      >
        <List className="h-3.5 w-3.5 mr-1" />
        Long
      </Button>
    </div>
  </div>
)}
```

## Usage Examples

### Example 1: Simple Comparison (Defaults to Pivot)
**Query**: "Show revenue and occupancy for ORR and RAAYA over 6 months"
- **Entities**: 2 (ORR, RAAYA)
- **Metrics**: 2 (revenue, occupancy)
- **Column Count**: 2 × 2 + 1 = **5 columns**
- **Default**: Pivot View ✓
- **User can toggle**: To long view if needed

### Example 2: Complex Multi-Entity (Defaults to Long)
**Query**: "Compare ADR, revenue, occupancy, F&B share, and RevPAR for Marriott, ORR, RAAYA, Hilton, and ITC over 12 months"
- **Entities**: 5 hotels
- **Metrics**: 5 (ADR, revenue, occupancy, F&B share, RevPAR)
- **Column Count**: 5 × 5 + 1 = **26 columns**
- **Default**: Long View ✓ (prevents horizontal scroll nightmare)
- **User can toggle**: To pivot if they really want to see it wide

## Benefits

### User Experience
✅ **Smart defaults**: No configuration needed, just works
✅ **User control**: Always can override the default
✅ **Subtle UI**: Doesn't clutter the interface
✅ **Clear labels**: Tooltips explain each view
✅ **Consistent formatting**: Both views respect metric types (currency, percentage)

### Performance
✅ **Client-side pivoting**: Fast, no server round-trip
✅ **Memoized calculation**: Column count only recalculated when data changes
✅ **Conditional rendering**: Only canonical data shows toggle

### Accessibility
✅ **Keyboard navigation**: Toggle buttons are focusable
✅ **Tooltips**: Explain what each view does
✅ **Visual indicators**: Active view clearly highlighted
✅ **Responsive**: Works on different screen sizes

## Testing Checklist

- [ ] Test query with 2 entities × 2 metrics → Verify defaults to Pivot
- [ ] Test query with 4 entities × 3 metrics → Verify defaults to Long (13 columns)
- [ ] Click toggle → Verify view switches immediately
- [ ] Toggle in Pivot view → Verify shows formatted values correctly
- [ ] Toggle to Long view → Verify shows raw canonical columns
- [ ] Check info row → Verify shows correct row/period counts
- [ ] Test non-canonical data → Verify toggle doesn't appear
- [ ] Save to dashboard → Verify old ChartRenderer tables unaffected

## Future Enhancements (Optional)

1. **Remember preference**: Store user's last toggle choice in localStorage
2. **Column threshold setting**: Allow user to configure the 6-column threshold
3. **Export options**: Add CSV/Excel export for both view modes
4. **Column filtering**: In long view, allow hiding certain canonical columns
5. **Sorting**: Click headers to sort by entity, metric, or period
