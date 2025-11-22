# Pivot Logic Fix - Summary

## Issue
When asking comparison queries like:
> "Compare monthly revenue data (room revenue, food and beverage revenue, other revenue, and total revenue) for Aloft ORR, JW Marriott Pune, and RAAYA BY ATMOSPHERE for January, February, and March 2025."

The AI was setting `pivot: false`, which meant:
- SQL generated **long format** (9 rows with entity column)
- Chart generator had to **auto-pivot** to wide format (3 rows with 12 columns)

## Expected Behavior
For multi-entity comparison queries, we want:
- SQL to generate **wide format directly** using CASE WHEN pivoting
- Chart generator to receive data ready for visualization
- Each entity × metric combination gets its own column

## Changes Made

### 1. Enhanced Preprocessing Prompt (`ai-sql-orchestrator/index.ts`)

Added explicit rules for when to use `pivot: true`:

```typescript
WHEN TO USE PIVOT = TRUE:
- Set pivot = true when the query compares MULTIPLE ENTITIES across metrics
- Set pivot = true when multiple specific hotels/properties/locations are mentioned
- Set pivot = true for queries like "compare X, Y, and Z" or "show revenue for A, B, and C"
- When pivot = true: pivotEntities MUST list the exact entity names
- When pivot = true: For EACH combination of entity + metric, create a column named "{Entity} {metric}"
- When pivot = false: Output will have an entity column (like asset_name) and metric columns
```

### 2. Enhanced SQL Generation Rules

Added explicit CASE WHEN examples for pivot implementation:

```sql
-- Example for pivot = true:
SELECT 
  month,
  SUM(CASE WHEN asset_name = 'Hotel A' THEN room_revenue ELSE 0 END) AS "Hotel A room_revenue",
  SUM(CASE WHEN asset_name = 'Hotel B' THEN room_revenue ELSE 0 END) AS "Hotel B room_revenue"
FROM table_name
GROUP BY month
ORDER BY month
```

## Expected Output

### For Your Example Query:

**Before (pivot: false):**
```json
{
  "pivot": false,
  "columns": [
    { "name": "month", "sourceColumn": "period_start" },
    { "name": "asset_name", "sourceColumn": "asset_name" },
    { "name": "room_revenue", "sourceColumn": "room_revenue" },
    { "name": "food_and_beverage_revenue", "sourceColumn": "food_and_beverage_revenue" },
    { "name": "other_revenue", "sourceColumn": "other_revenue" },
    { "name": "total_revenue", "derived": true }
  ]
}
```

**After (pivot: true):**
```json
{
  "pivot": true,
  "pivotEntities": ["Aloft ORR", "JW Marriott Pune", "RAAYA BY ATMOSPHERE"],
  "columns": [
    { "name": "month", "sourceColumn": "period_start" },
    { "name": "Aloft ORR room_revenue", "sourceColumn": "room_revenue" },
    { "name": "Aloft ORR food_and_beverage_revenue", "sourceColumn": "food_and_beverage_revenue" },
    { "name": "Aloft ORR other_revenue", "sourceColumn": "other_revenue" },
    { "name": "Aloft ORR total_revenue", "derived": true },
    { "name": "JW Marriott Pune room_revenue", "sourceColumn": "room_revenue" },
    { "name": "JW Marriott Pune food_and_beverage_revenue", "sourceColumn": "food_and_beverage_revenue" },
    { "name": "JW Marriott Pune other_revenue", "sourceColumn": "other_revenue" },
    { "name": "JW Marriott Pune total_revenue", "derived": true },
    { "name": "RAAYA BY ATMOSPHERE room_revenue", "sourceColumn": "room_revenue" },
    { "name": "RAAYA BY ATMOSPHERE food_and_beverage_revenue", "sourceColumn": "food_and_beverage_revenue" },
    { "name": "RAAYA BY ATMOSPHERE other_revenue", "sourceColumn": "other_revenue" },
    { "name": "RAAYA BY ATMOSPHERE total_revenue", "derived": true }
  ]
}
```

### Result Data Structure:

**3 rows × 13 columns** (1 month column + 12 metric columns):
```javascript
[
  {
    month: 'January 2025',
    'Aloft ORR room_revenue': 100000,
    'Aloft ORR food_and_beverage_revenue': 50000,
    'Aloft ORR other_revenue': 20000,
    'Aloft ORR total_revenue': 170000,
    'JW Marriott Pune room_revenue': 150000,
    'JW Marriott Pune food_and_beverage_revenue': 80000,
    'JW Marriott Pune other_revenue': 30000,
    'JW Marriott Pune total_revenue': 260000,
    'RAAYA BY ATMOSPHERE room_revenue': 200000,
    'RAAYA BY ATMOSPHERE food_and_beverage_revenue': 120000,
    'RAAYA BY ATMOSPHERE other_revenue': 40000,
    'RAAYA BY ATMOSPHERE total_revenue': 360000
  },
  { month: 'February 2025', ... },
  { month: 'March 2025', ... }
]
```

## Benefits

✅ **Simpler chart generation**: Data arrives in the exact format needed for visualization  
✅ **Better SQL control**: SQL does the pivoting, not the chart generator  
✅ **Consistent behavior**: Multi-entity comparisons always generate wide format  
✅ **Cleaner code**: Chart generator doesn't need to auto-pivot in most cases  

## Deployment

To apply these changes:

```bash
supabase functions deploy ai-sql-orchestrator
```

## Fallback Behavior

The chart generator **still has auto-pivot logic** as a safety net:
- If SQL somehow returns long format, chart generator will detect and pivot
- This ensures backward compatibility with existing queries

## Testing

Try your original query again:
> "compare revenue data for orr, marriot and raaya for JFM 2025"

Expected result:
- `pivot: true` in the response
- 3 rows (one per month)
- 12+ metric columns (3 hotels × 4+ metrics each)
