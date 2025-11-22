# Chart Disappearing Issue - Fixed ✅

## Problem
When asking a query in the AI chat, charts would generate successfully but then disappear when the page refreshed or when navigating between chat sessions.

## Root Cause
The `chart_suggestion.data` field was not being passed from the database through to the rendering components.

### Data Flow
1. ✅ User asks query → `AskAI.tsx`
2. ✅ `useChatSession.sendMessage()` invoked
3. ✅ User message saved to DB
4. ✅ AI orchestrator function called
5. ✅ Assistant response saved to DB with `chart_suggestion` JSON including:
   - `chartType`: 'line' | 'bar' | 'combo' | etc.
   - `config`: ChartConfig object
   - `data`: CanonicalRow[] array ⚠️ **This was being lost!**
6. ✅ Messages refetched from DB
7. ❌ **BROKEN:** `AskAI.tsx` only passed `chartType` and `config`, missing `data`
8. ❌ **RESULT:** `CanonicalChartRenderer` never received data, so chart didn't render

## Fix Applied

### 1. Updated `useChatSession.ts` interface
```typescript
interface ChatMessage {
  // ... other fields
  chart_suggestion?: {
    chartType: string;
    config: any;
    data?: any;  // ✅ Added missing data field
  };
}
```

### 2. Updated `AskAI.tsx` to pass data
```typescript
chartSuggestion={message.chart_suggestion ? {
  chartType: message.chart_suggestion.chartType as 'bar' | 'line' | 'pie' | 'area' | 'table' | 'combo',
  config: message.chart_suggestion.config,
  data: message.chart_suggestion.data  // ✅ Now passing data!
} : undefined}
```

## How It Works Now

### Chart Rendering Logic in `ChatMessage.tsx`
```typescript
{showChart && generatedChart && (
  <div className="mb-3">
    {generatedChart.config && generatedChart.data ? (
      // ✅ NEW CANONICAL CHARTS - Uses the data from chart_suggestion
      <CanonicalChartRenderer 
        config={generatedChart.config as ChartConfig}
        data={generatedChart.data as CanonicalRow[]}
      />
    ) : (
      // ✅ FALLBACK - Legacy chart renderer with query_result
      <ChartRenderer 
        type={generatedChart.chartType} 
        data={queryResult} 
        config={generatedChart.config}
      />
    )}
  </div>
)}
```

## What This Enables

✅ **Persistent Charts**: Charts now survive page refreshes and session switches  
✅ **Canonical Format**: The new `CanonicalChartRenderer` gets the properly formatted data  
✅ **Backward Compatibility**: Old charts without data field still work via fallback  
✅ **Database-First**: Chart data is stored in `chart_suggestion` JSONB field in Supabase  

## Testing

To verify the fix:
1. Ask a query that generates a chart
2. Click "Generate Chart"
3. Refresh the page
4. Switch to another chat session and back
5. **Expected**: Chart should still be visible and render correctly

## Files Modified
- `/src/hooks/useChatSession.ts` - Added `data` field to `chart_suggestion` interface
- `/src/pages/AskAI.tsx` - Pass `data` field to `ChatMessage` component
