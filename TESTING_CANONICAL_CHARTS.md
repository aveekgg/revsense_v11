# End-to-End Testing Guide - Canonical Chart Flow

## Overview
This guide helps you test the complete canonical long-format data flow from SQL generation to chart rendering.

## Prerequisites
- ✅ Edge functions deployed (`ai-sql-orchestrator`, `ai-chart-generator`)
- ✅ Frontend components updated (`CanonicalChartRenderer`, `ChatMessage`, `DashboardChartItem`)
- ✅ Development server running

## Test Scenarios

### Test 1: Multi-Entity Revenue Comparison (Basic)

**Query:**
```
What was the revenue of Marriott vs ORR over the last 7 months?
```

**Expected Behavior:**
1. SQL orchestrator returns canonical rows with:
   - `period`, `period_grain: "month"`, `entity_name`, `metric_name: "total_revenue"`, `metric_value`
2. Chart generator returns:
   ```json
   {
     "config": {
       "chartType": "combo" or "bar",
       "xTimeFormat": "MMM-yy",
       "timeGrain": "month",
       "series": [
         { "metric_name": "total_revenue", "entity_name": "JW Marriott Pune", "type": "bar", "yAxisId": "left" },
         { "metric_name": "total_revenue", "entity_name": "ORR Hotel", "type": "bar", "yAxisId": "left" }
       ],
       "yAxes": [{ "id": "left", "format": "currency" }]
     },
     "data": [/* canonical rows */]
   }
   ```
3. Chart displays:
   - X-axis labels: `May-25`, `Jun-25`, `Jul-25`, etc.
   - Two bars per month (one for each hotel)
   - Currency formatting on Y-axis
   - Legend showing both hotel names

**Verification Checklist:**
- [ ] X-axis shows `MMM-yy` format (not full dates)
- [ ] Data sorted chronologically
- [ ] Bars grouped by month
- [ ] Currency values formatted with $ and commas
- [ ] Legend shows entity names clearly
- [ ] Tooltip shows formatted values

---

### Test 2: Multi-Metric with Percentages (Advanced)

**Query:**
```
Show me revenue and F&B percentage of total revenue for Marriott and ORR over the last 7 months
```

**Expected Behavior:**
1. SQL returns canonical rows with:
   - `metric_name: "total_revenue"`, `metric_type: "absolute"`
   - `metric_name: "fnb_share_of_total"`, `metric_type: "percentage"`, `metric_value` in 0-100 range
2. Chart generator returns:
   ```json
   {
     "config": {
       "chartType": "combo",
       "series": [
         { "metric_name": "total_revenue", "entity_name": "JW Marriott Pune", "type": "bar", "yAxisId": "left" },
         { "metric_name": "total_revenue", "entity_name": "ORR Hotel", "type": "bar", "yAxisId": "left" },
         { "metric_name": "fnb_share_of_total", "entity_name": "JW Marriott Pune", "type": "line", "yAxisId": "right" },
         { "metric_name": "fnb_share_of_total", "entity_name": "ORR Hotel", "type": "line", "yAxisId": "right" }
       ],
       "yAxes": [
         { "id": "left", "label": "Revenue", "format": "currency" },
         { "id": "right", "label": "F&B %", "format": "percentage" }
       ]
     }
   }
   ```
3. Chart displays:
   - Dual Y-axes (left: revenue, right: percentage)
   - Bars for revenue metrics
   - Lines for percentage metrics
   - Percentage values showing as `25.3%` (not `0.253`)

**Verification Checklist:**
- [ ] Two Y-axes visible (left and right)
- [ ] Bars use left axis, lines use right axis
- [ ] Percentages display as 0-100 (e.g., 25.3%)
- [ ] Different colors for bars vs lines
- [ ] Legend distinguishes all 4 series
- [ ] Tooltip formats values correctly per axis

---

### Test 3: Quarterly Aggregation

**Query:**
```
Show quarterly revenue for all hotels this year
```

**Expected Behavior:**
1. SQL returns:
   - `period_grain: "quarter"`
   - `period`: `"2025-01-01"`, `"2025-04-01"`, `"2025-07-01"`, `"2025-10-01"`
2. Chart config:
   - `xTimeFormat: "Q-yy"`
3. Chart displays:
   - X-axis labels: `Q1-25`, `Q2-25`, `Q3-25`, `Q4-25`

**Verification Checklist:**
- [ ] X-axis shows quarter format (not months)
- [ ] Only 4 data points (one per quarter)
- [ ] Labels are `Q1-25`, `Q2-25`, etc.

---

### Test 4: Save to Dashboard & Refresh

**Steps:**
1. Generate a chart from a query (use Test 1 or Test 2)
2. Click "Save to Dashboard"
3. Choose a dashboard and save
4. Navigate to Dashboards page
5. Find the saved chart
6. Click "Refresh" button

**Expected Behavior:**
1. Chart saves with canonical config + data
2. Dashboard loads and displays chart using `CanonicalChartRenderer`
3. Refresh re-runs SQL and updates data
4. Chart config stays stable (axes, colors, labels don't change)

**Verification Checklist:**
- [ ] Chart appears on dashboard with correct title
- [ ] Chart renders identically to chat view
- [ ] Refresh button works
- [ ] After refresh, chart still renders correctly
- [ ] Config persists (colors, axes, labels stay same)

---

## Debugging Tips

### Chart Not Rendering
1. **Check browser console** for errors
2. **Inspect Network tab**:
   - Filter for `ai-chart-generator`
   - Check response has `{ config, data }` structure
3. **Check data structure**:
   - Open React DevTools
   - Find `CanonicalChartRenderer` component
   - Verify props have correct shape

### Wrong Time Labels
1. Check `period_grain` in SQL response
2. Verify `xTimeFormat` in chart config matches grain
3. Check console for date parsing errors

### Percentages Showing Wrong
1. Verify `metric_type === "percentage"` in canonical rows
2. Check `metric_value` is in 0-100 range (not 0-1)
3. Verify Y-axis has `format: "percentage"`

### Missing Entities/Metrics
1. Check SQL includes all requested entities in WHERE clause
2. Verify UNION ALL for all metrics
3. Check series config has entry for each (entity, metric) combo

### Old Format Still Showing
The frontend supports **both** old and new formats:
- If response has `{ config, data }` → uses `CanonicalChartRenderer`
- If response has `{ chartType, config }` → uses old `ChartRenderer`

Check which one is rendering by inspecting component tree in DevTools.

---

## Common Test Queries

### Single Metric, Single Entity
```
Show revenue trend for Marriott over last 6 months
```
Expected: Line chart, one series

### Single Metric, Multiple Entities
```
Compare occupancy rates across all hotels last quarter
```
Expected: Bar chart, multiple bars per period

### Multiple Metrics, Single Entity
```
Show Marriott's revenue, occupancy, and ADR over last year
```
Expected: Combo chart, multiple lines

### Complex Multi-Everything
```
Compare total revenue and F&B percentage for Marriott, ORR, and Raaya over the last 7 months
```
Expected: Combo chart with 6 series (3 entities × 2 metrics), dual axes

---

## Success Criteria

✅ All test scenarios render correctly
✅ Time labels formatted properly for all grains
✅ Percentages show in 0-100 range
✅ Dual axes work when mixing absolute + percentage
✅ Charts save to dashboard and refresh correctly
✅ No console errors during normal operation
✅ Canonical data structure visible in Network tab
✅ Chart config is stable and reusable

---

## Rollback Plan (If Needed)

If issues arise, you can temporarily revert frontend to use old format:

1. Comment out `CanonicalChartRenderer` imports in `ChatMessage.tsx`
2. Remove conditional rendering that checks for `config.chartType`
3. Keep using `ChartRenderer` with pivoted data

The edge functions will still return canonical data, but the AI can pivot it if needed by updating the prompt.

---

## Next Steps After Testing

1. **Monitor production** for any edge cases
2. **Gather user feedback** on chart clarity
3. **Optimize** chart colors and styling
4. **Add more chart types** (stacked bars, area charts)
5. **Implement chart export** (PNG/CSV)
6. **Add chart templates** for common queries
