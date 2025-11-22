# Debug Chart Persistence Issue

## Steps to Debug

I've added detailed console logging to track the chart persistence flow. Follow these steps:

### 1. Generate a Chart
1. Open your browser console (F12 or Cmd+Option+I)
2. Clear the console
3. Ask a question that generates data (e.g., "what was revenue for ORR over last 5 months")
4. Click "Generate Chart"

**Look for these logs:**
```
🎨 Raw response from ai-chart-generator: {...}
💾 Chart suggestion to save: {...}
📝 Message ID: xxx-xxx-xxx
✅ Chart suggestion saved to database successfully
📊 Updated record: [...]
```

**What to check:**
- Does the "Chart suggestion to save" log show the correct structure with `chartType`, `config`, and `data`?
- Is there a "✅ Chart suggestion saved" message or "❌ Failed to save" error?
- If there's an error, what does it say?

### 2. Reload the Page
1. Keep the console open
2. Refresh the page (Cmd+R or F5)

**Look for these logs:**
```
📨 Fetched messages from DB: [...]
📨 Messages with chart_suggestion: [...]
🔍 ChatMessage render - Message ID: xxx
🔍 chartSuggestion prop: {...}
🔍 generatedChart state: {...}
🔄 useEffect triggered - chartSuggestion: {...}
✅ Setting generatedChart from chartSuggestion
```

**What to check:**
- Does "Fetched messages from DB" show your messages?
- Does "Messages with chart_suggestion" show any messages with chart data?
- Is the `chartSuggestion prop` null/undefined or does it have data?
- Does the useEffect get triggered?

### 3. Common Issues to Check

#### Issue A: Chart not saved to DB
**Symptoms:** No "✅ Chart suggestion saved" log, or error shown

**Solutions:**
- Check if RLS (Row Level Security) is blocking the update
- Verify the message ID exists in the database
- Check if the user owns the message (user_id matches)

#### Issue B: Chart saved but not loaded
**Symptoms:** "✅ saved" log shown, but after reload "chartSuggestion prop" is null

**Solutions:**
- The fetch query might not be including `chart_suggestion` field
- RLS might be filtering it out
- The JSONB might be getting corrupted

#### Issue C: Chart loaded but not displayed
**Symptoms:** "chartSuggestion prop" has data, but button still shows "Generate Chart"

**Solutions:**
- Check if `generatedChart state` is being set correctly
- Check if useEffect is running
- Check the button logic in the component

### 4. Manual Database Check

Open Supabase SQL Editor and run:

```sql
SELECT 
    id,
    role,
    LEFT(content, 50) as content_preview,
    chart_suggestion IS NOT NULL as has_chart_suggestion,
    jsonb_typeof(chart_suggestion) as chart_suggestion_type,
    chart_suggestion,
    created_at
FROM chat_messages
WHERE role = 'assistant'
  AND sql_query IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**What to check:**
- Is `has_chart_suggestion` TRUE for messages where you generated charts?
- Is `chart_suggestion_type` = 'object'?
- Does the `chart_suggestion` column show the correct JSON structure?

Expected structure:
```json
{
  "chartType": "combo",
  "config": {
    "chartType": "combo",
    "xKey": "period",
    ...
  },
  "data": [...]
}
```

### 5. Report Your Findings

Please share:
1. What logs you see in the console (copy/paste the relevant ones)
2. What the database query shows
3. At which step the flow breaks

This will help me identify exactly where the issue is!
