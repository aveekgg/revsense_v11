# Fix: Cannot Save Combo Charts to Dashboard

## Problem
When trying to save a canonical chart (combination chart) to a dashboard, you get this error:
```
Error: Failed to save to dashboard: new row for relation "dashboard_charts" 
violates check constraint "dashboard_charts_chart_type_check"
```

## Root Cause
The `dashboard_charts` table has a CHECK constraint that only allows these chart types:
- `'bar'`
- `'line'`
- `'pie'`
- `'area'`
- `'table'`

But the new canonical chart system uses `'combo'` for charts with multiple series types (like bar + line combinations), which is **not** in the allowed list.

## Solution: Add 'combo' to Allowed Chart Types

### Option 1: Run SQL in Supabase Dashboard (RECOMMENDED)

1. **Go to Supabase Dashboard**:
   - Visit: https://supabase.com/dashboard/project/djskqegnpplmnyrzomri
   - Login if needed

2. **Open SQL Editor**:
   - Click "SQL Editor" in the left sidebar
   - Click "+ New query" button

3. **Run the Fix**:
   - Copy the contents of `FIX_COMBO_CHART_TYPE.sql`
   - Paste into the SQL editor
   - Click "Run" (or press Cmd+Enter)

4. **Verify Success**:
   - You should see output showing the updated constraint:
     ```
     CHECK (chart_type = ANY (ARRAY['bar', 'line', 'pie', 'area', 'table', 'combo']))
     ```

### Option 2: Use Supabase CLI (If migrations are in sync)

```bash
cd /Users/aveek/revsense
npx supabase db push
```

**Note**: This currently fails because local and remote migrations are out of sync. Use Option 1 instead.

## After Fix

Once the SQL is run, you should be able to:
- ✅ Save canonical charts with `chartType: 'combo'` to dashboards
- ✅ Save charts with multiple series types (bar, line, area combined)
- ✅ All existing functionality continues to work

## Test It

1. Run the SQL fix above
2. Go to Ask AI page
3. Ask: "Show ADR and Occupancy for Aloft ORR over last 6 months"
4. Click "Generate Chart"
5. Click "Add to Dashboard"
6. Select a dashboard and save
7. **Result**: Should save successfully without constraint error

## Technical Details

### Database Schema Change
```sql
-- Before:
CHECK (chart_type IN ('bar', 'line', 'pie', 'area', 'table'))

-- After:
CHECK (chart_type IN ('bar', 'line', 'pie', 'area', 'table', 'combo'))
```

### Why 'combo' is Needed
The new `CanonicalChartRenderer` uses Recharts' `ComposedChart` component which allows mixing multiple chart types in one visualization:
- Multiple entities as bars (side-by-side comparison)
- Different metrics with different Y-axes (dual axis)
- Mix of bar, line, and area series

### Chart Type Mapping
| Chart Type | Used For | Component |
|------------|----------|-----------|
| `bar` | Simple bar charts | `<BarChart>` |
| `line` | Simple line charts | `<LineChart>` |
| `area` | Simple area charts | `<AreaChart>` |
| `pie` | Pie/donut charts | `<PieChart>` |
| `table` | Data tables | `EnhancedDataTable` |
| **`combo`** | **Multi-entity, multi-metric canonical charts** | **`<ComposedChart>`** |

### Files Affected
- **Database**: `public.dashboard_charts` table constraint
- **Frontend**: 
  - `src/components/chat/ChatMessage.tsx` - Saves charts with type 'combo'
  - `src/components/dashboard/DashboardChartItem.tsx` - Renders 'combo' charts
  - `src/components/charts/CanonicalChartRenderer.tsx` - Uses ComposedChart
  - `supabase/functions/ai-chart-generator/index.ts` - Generates 'combo' config

## Troubleshooting

### If the Fix Doesn't Work
1. **Check constraint was updated**:
   ```sql
   SELECT conname, pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conname = 'dashboard_charts_chart_type_check';
   ```

2. **Verify 'combo' is in the list**:
   - Look for `'combo'` in the output

3. **Still getting error?**:
   - Check the `chart_type` value being saved in browser DevTools:
     - Network tab → Filter "dashboard_charts" → Check request payload
   - Verify it's exactly `'combo'` (lowercase, no extra spaces)

### If You Need to Rollback
```sql
-- Revert to original constraint (removes 'combo')
ALTER TABLE public.dashboard_charts 
DROP CONSTRAINT IF EXISTS dashboard_charts_chart_type_check;

ALTER TABLE public.dashboard_charts 
ADD CONSTRAINT dashboard_charts_chart_type_check 
CHECK (chart_type IN ('bar', 'line', 'pie', 'area', 'table'));
```

## Prevention

To avoid this issue in future:
1. Always check database constraints before adding new enum-like values
2. Test save functionality end-to-end before deployment
3. Keep migration files in sync between local and remote

## Related Documentation
- `CANONICAL_DATA_MIGRATION_GUIDE.md` - Overview of canonical chart system
- `TWO_LEVEL_PIVOT_HEADERS.md` - Table improvements
- `IMPLEMENTATION_COMPLETE.md` - Full implementation details
