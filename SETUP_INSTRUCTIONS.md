# RevSense AI Query Agent Setup Instructions

## 1. Database Setup

Run the SQL script in your Supabase SQL Editor:
- Open your Supabase project dashboard
- Navigate to SQL Editor
- Copy and paste the contents from `supabase/migrations/001_initial_schema.sql`
- Execute the query

This will create:
- All necessary tables (schemas, mappings, clean_data, chat_sessions, etc.)
- Row Level Security (RLS) policies
- Indexes for performance
- Safe SQL execution function

## 2. Add OpenAI API Key

The AI SQL orchestrator requires an OpenAI API key:

1. Go to your Supabase project dashboard
2. Navigate to Project Settings → Edge Functions → Secrets
3. Add a new secret:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key (get one from https://platform.openai.com/)

## 3. Deploy Edge Function

The `ai-sql-orchestrator` edge function has been created and will be automatically deployed.

To manually test it after deployment:
```bash
curl -X POST 'https://[your-project-ref].supabase.co/functions/v1/ai-sql-orchestrator' \
  -H 'Authorization: Bearer [your-anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{
    "userQuery": "Show me total revenue",
    "sessionId": "test-session-id",
    "chatHistory": []
  }'
```

## 4. Migrate Existing Data (Optional)

If you have data in localStorage, you can migrate it to Supabase:

1. The migration utilities are in `src/lib/migration.ts` (to be created)
2. Call the migration functions once
3. Then switch from localStorage hooks to Supabase hooks

## 5. Update Your Components

Replace localStorage-based storage with Supabase hooks:

### For Schemas:
```typescript
// Old
import { getAllSchemas, saveSchema } from '@/lib/schemaStorage';

// New
import { useSupabaseSchemas } from '@/hooks/useSupabaseSchemas';
const { schemas, createSchema, updateSchema, deleteSchema } = useSupabaseSchemas();
```

### For Mappings:
```typescript
// Old
import { getAllMappings, saveMappingToStorage } from '@/lib/mappingStorage';

// New
import { useSupabaseMappings } from '@/hooks/useSupabaseMappings';
const { mappings, createMapping, deleteMapping } = useSupabaseMappings(schemaId);
```

### For Chat:
```typescript
import { useChatSession } from '@/hooks/useChatSession';

const { 
  messages, 
  currentSessionId, 
  createSession, 
  sendMessage,
  isSendingMessage 
} = useChatSession();

// Create new chat session
createSession('My Analysis Session');

// Send a message (AI will respond automatically)
sendMessage('What is the total revenue for Q4?');
```

## 6. Next Steps

Phase 1 (Backend Foundation) is now complete with:
- ✅ Database tables and RLS
- ✅ Supabase client hooks
- ✅ AI SQL orchestrator edge function
- ✅ Chart renderer component
- ✅ Chat message component with SQL display

Next phases to implement:
- Enhance RightChatPane to use the new chat hooks
- Create Dashboard page for chart management
- Add business context management UI
- Build data migration utilities
- Add "Add to Dashboard" functionality

## Architecture Overview

```
User Query → RightChatPane (Frontend)
    ↓
    sendMessage() → Supabase Edge Function
    ↓
    ai-sql-orchestrator
    ↓ (OpenAI API)
    Classification Agent → SQL Generator Agent
    ↓
    execute_safe_query() → PostgreSQL
    ↓
    Results + Chart Config
    ↓
    ChatMessage Component → Display Chart/Table
```

## Security Notes

- All database operations use Row Level Security (RLS)
- Only SELECT queries are allowed through execute_safe_query
- SQL injection protection built-in
- User authentication required for all operations
- OpenAI API key stored securely in Supabase secrets
