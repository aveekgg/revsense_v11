# Two-Level Pivot Table Headers

## Overview
Pivoted canonical tables now display with **two-level headers** for better readability and organization:
- **Top level**: Entity names (merged cells spanning all metrics for that entity)
- **Bottom level**: Metric names (individual columns under each entity)

## Visual Example

### Query
```
"Show the Average Daily Rate (ADR) and Occupancy Rate for Aloft ORR and RAAYA BY ATMOSPHERE for each of the last 6 months"
```

### Old Single-Level Headers (BEFORE)
```
| Period | _period    | Aloft ORR - ADR | Aloft ORR - Occupancy Rate | RAAYA BY ATMOSPHERE - ADR | RAAYA BY ATMOSPHERE - Occupancy Rate |
```
❌ **Issues**:
- Duplicate `_period` column visible
- Entity names repeated in every column
- Hard to visually group metrics by entity

### New Two-Level Headers (AFTER)
```
┌────────┬─────────────────────────────────┬─────────────────────────────────────────┐
│        │         Aloft ORR               │      RAAYA BY ATMOSPHERE                │
│ Period ├──────────────────┬──────────────┼──────────────────┬──────────────────────┤
│        │       ADR        │ Occupancy    │       ADR        │ Occupancy Rate       │
│        │                  │ Rate         │                  │                      │
├────────┼──────────────────┼──────────────┼──────────────────┼──────────────────────┤
│ Jun-25 │    $4,234.56     │    88.2%     │    $3,456.78     │       75.1%          │
│ Jul-25 │    $4,567.89     │    91.5%     │    $3,678.90     │       78.3%          │
│ Aug-25 │    $4,890.12     │    93.8%     │    $3,890.12     │       81.2%          │
│ Sep-25 │    $4,123.45     │    87.4%     │    $3,234.56     │       73.5%          │
│ Oct-25 │    $3,987.65     │    82.1%     │    $3,123.45     │       69.8%          │
│ Nov-25 │    $4,321.09     │    89.7%     │    $3,456.78     │       76.4%          │
└────────┴──────────────────┴──────────────┴──────────────────┴──────────────────────┘
```

✅ **Improvements**:
- Entity names in merged top-level headers
- Clean metric labels without entity repetition
- Visual borders group metrics by entity
- No duplicate `_period` column

## Implementation Details

### Component: `PivotedCanonicalTable.tsx`

#### Key Features
1. **Column Parsing**: Extracts entity and metric from "Entity - Metric" format
2. **Grouping Logic**: Groups all metrics belonging to the same entity
3. **Two-Row Header**:
   - Row 1: Entity names with `colSpan` for merged cells
   - Row 2: Individual metric labels
4. **Visual Separation**: Border between entity groups for clarity

#### Header Structure
```tsx
<TableHeader>
  {/* First header row - Entity names (merged cells) */}
  <TableRow>
    <TableHead rowSpan={2}>Period</TableHead>
    {entityGroups.map(group => (
      <TableHead colSpan={group.metrics.length}>
        {group.entity}
      </TableHead>
    ))}
  </TableRow>
  
  {/* Second header row - Metric names */}
  <TableRow>
    {entityGroups.map(group =>
      group.metrics.map(col => {
        const metricLabel = col.split(' - ')[1];
        return <TableHead>{metricLabel}</TableHead>;
      })
    )}
  </TableRow>
</TableHeader>
```

#### Styling Features
- **Sticky header**: Stays visible when scrolling vertically
- **Entity row background**: `bg-muted/50` to distinguish from metric row
- **Border-right**: Visual separator between entity groups
- **Text alignment**: 
  - Entity names: `text-center`
  - Metric names: Left-aligned
  - Values: `text-right` for numbers
- **Row striping**: Even/odd row colors for readability

### Data Structure

#### Input Format
```typescript
[
  {
    Period: "Jun-25",
    "Aloft ORR - ADR": "$4,234.56",
    "Aloft ORR - Occupancy Rate": "88.2%",
    "RAAYA BY ATMOSPHERE - ADR": "$3,456.78",
    "RAAYA BY ATMOSPHERE - Occupancy Rate": "75.1%"
  },
  // ... more periods
]
```

#### Parsed Entity Groups
```typescript
[
  {
    entity: "Aloft ORR",
    metrics: ["Aloft ORR - ADR", "Aloft ORR - Occupancy Rate"]
  },
  {
    entity: "RAAYA BY ATMOSPHERE",
    metrics: ["RAAYA BY ATMOSPHERE - ADR", "RAAYA BY ATMOSPHERE - Occupancy Rate"]
  }
]
```

## Edge Cases Handled

### 1. Single Metric per Entity
```
┌────────┬────────────┬────────────┐
│        │  Marriott  │   Hilton   │
│ Period ├────────────┼────────────┤
│        │  Revenue   │  Revenue   │
├────────┼────────────┼────────────┤
│ Jun-25 │ $1,234,567 │ $987,654   │
```
Each entity gets one column, still grouped properly.

### 2. Many Metrics (5+ per Entity)
```
┌────────┬──────────────────────────────────────────────────────────────────┐
│        │                        Grand Hyatt                                │
│ Period ├──────┬──────┬───────────┬──────────┬─────────┬──────────────────┤
│        │  ADR │ RevPAR │ Occupancy │  Revenue │ F&B Share │ Avg Stay (days) │
```
Column span adjusts automatically.

### 3. Long Entity Names
Entity names are displayed in full in the merged header without truncation. If the entity name is very long, the table will expand horizontally (scrollable).

### 4. Column Order Preservation
Metrics appear in the same order they appear in the data, grouped by entity.

## Benefits

### User Experience
✅ **Clearer visual hierarchy**: Easy to see which metrics belong to which entity  
✅ **Reduced redundancy**: Entity names not repeated in every column  
✅ **Better comparison**: Side-by-side metrics for each entity  
✅ **Professional appearance**: Looks like a business report  

### Accessibility
✅ **Semantic HTML**: Uses proper `rowSpan` and `colSpan` attributes  
✅ **Screen reader friendly**: Headers properly associated with data cells  
✅ **Keyboard navigation**: Tab order follows logical reading pattern  

### Responsiveness
✅ **Horizontal scroll**: If too many entities/metrics  
✅ **Sticky headers**: Both header rows stick when scrolling  
✅ **Collapsible pagination**: Show 10 rows by default, expand to see all  

## Related Changes

### Files Modified
1. **`CanonicalDataTable.tsx`**:
   - Removed `_period` internal column from pivoted data
   - Uses `PivotedCanonicalTable` for pivot view instead of `EnhancedDataTable`
   
2. **Files Created**:
   - `PivotedCanonicalTable.tsx`: New specialized component for two-level headers

### Files Unchanged
- `EnhancedDataTable.tsx`: Still used for long-form view (no changes needed)
- `ChatMessage.tsx`: No changes needed (just passes viewMode prop)

## Testing Checklist

- [ ] Query with 2 entities × 2 metrics → Verify two-level headers render correctly
- [ ] Query with 5 entities × 3 metrics → Verify entity groups separated with borders
- [ ] Long entity names → Verify merged cells expand appropriately
- [ ] Single metric per entity → Verify colSpan=1 works
- [ ] Scroll horizontally → Verify Period column stays sticky
- [ ] Scroll vertically → Verify both header rows stay sticky
- [ ] Toggle to Long view → Verify switch works and _period not visible in long view
- [ ] Toggle back to Pivot → Verify two-level headers reappear

## Future Enhancements

1. **Sortable headers**: Click metric name to sort by that column
2. **Resizable columns**: Drag column borders to adjust width
3. **Frozen Period column**: Keep Period column visible when scrolling horizontally
4. **Export to Excel**: Preserve two-level headers in exported file
5. **Conditional formatting**: Highlight high/low values per metric
6. **Metric comparison**: Show variance/delta between entities in additional row
