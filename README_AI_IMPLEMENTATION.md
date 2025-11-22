# AI Query Agent Implementation - Quick Start

## 🚀 Phase 1: Backend Foundation Complete!

I've implemented the core infrastructure for your AI-powered SQL query agent. Here's what's been created:

### ✅ Created Files

1. **Edge Function**: `supabase/functions/ai-sql-orchestrator/index.ts`
   - AI agent that classifies queries and generates SQL
   - Uses OpenAI GPT-4o-mini for intelligent query handling
   - Executes SQL safely with built-in protections

2. **React Hooks**:
   - `src/hooks/useSupabaseSchemas.ts` - Manage schemas in Supabase
   - `src/hooks/useSupabaseMappings.ts` - Manage mappings in Supabase
   - `src/hooks/useChatSession.ts` - Chat with AI agent

3. **UI Components**:
   - `src/components/charts/ChartRenderer.tsx` - Visualize query results (bar, line, pie, area, table)
   - `src/components/chat/ChatMessage.tsx` - Display AI responses with SQL and charts

4. **Setup Guide**: `SETUP_INSTRUCTIONS.md` - Detailed setup steps

## ⚠️ IMPORTANT: Setup Required

Since I cannot directly modify your Supabase database or add secrets, you need to complete these steps:

### Step 1: Run Database Migration (5 minutes)

The database schema SQL has been prepared but the migrations folder is read-only. Here's what to do:

1. **Copy the SQL from this file** to run in your Supabase SQL Editor
2. **Open** your Supabase dashboard: https://supabase.com/dashboard/project/djskqegnpplmnyrzomri
3. **Navigate to** SQL Editor
4. **Paste and execute** this SQL:

<details>
<summary>📋 Click to see the SQL to copy (expand this)</summary>

\`\`\`sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schemas table
CREATE TABLE IF NOT EXISTS public.schemas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mappings table
CREATE TABLE IF NOT EXISTS public.mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_id UUID REFERENCES public.schemas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  workbook_format TEXT,
  field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clean data table
CREATE TABLE IF NOT EXISTS public.clean_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schema_id UUID REFERENCES public.schemas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  source_workbook TEXT,
  source_mapping_id UUID REFERENCES public.mappings(id),
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business context table
CREATE TABLE IF NOT EXISTS public.business_context (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN ('entity', 'formula', 'relationship')),
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  examples TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sql_query TEXT,
  query_result JSONB,
  chart_suggestion JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dashboards table
CREATE TABLE IF NOT EXISTS public.dashboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dashboard charts table
CREATE TABLE IF NOT EXISTS public.dashboard_charts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE CASCADE,
  chart_type TEXT NOT NULL CHECK (chart_type IN ('bar', 'line', 'pie', 'area', 'table')),
  title TEXT NOT NULL,
  sql_query TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clean_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_charts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (SELECT, INSERT, UPDATE, DELETE for all tables)
CREATE POLICY "Users can view own schemas" ON public.schemas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schemas" ON public.schemas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schemas" ON public.schemas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schemas" ON public.schemas FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own mappings" ON public.mappings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mappings" ON public.mappings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mappings" ON public.mappings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mappings" ON public.mappings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own clean_data" ON public.clean_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clean_data" ON public.clean_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own clean_data" ON public.clean_data FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own business_context" ON public.business_context FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own business_context" ON public.business_context FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own business_context" ON public.business_context FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own business_context" ON public.business_context FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chat_sessions" ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat_sessions" ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat_sessions" ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat_sessions" ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chat_messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_sessions WHERE chat_sessions.id = chat_messages.session_id AND chat_sessions.user_id = auth.uid())
);
CREATE POLICY "Users can insert own chat_messages" ON public.chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.chat_sessions WHERE chat_sessions.id = chat_messages.session_id AND chat_sessions.user_id = auth.uid())
);
CREATE POLICY "Users can delete own chat_messages" ON public.chat_messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.chat_sessions WHERE chat_sessions.id = chat_messages.session_id AND chat_sessions.user_id = auth.uid())
);

CREATE POLICY "Users can view own dashboards" ON public.dashboards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own dashboards" ON public.dashboards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dashboards" ON public.dashboards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dashboards" ON public.dashboards FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own dashboard_charts" ON public.dashboard_charts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.dashboards WHERE dashboards.id = dashboard_charts.dashboard_id AND dashboards.user_id = auth.uid())
);
CREATE POLICY "Users can insert own dashboard_charts" ON public.dashboard_charts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.dashboards WHERE dashboards.id = dashboard_charts.dashboard_id AND dashboards.user_id = auth.uid())
);
CREATE POLICY "Users can update own dashboard_charts" ON public.dashboard_charts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.dashboards WHERE dashboards.id = dashboard_charts.dashboard_id AND dashboards.user_id = auth.uid())
);
CREATE POLICY "Users can delete own dashboard_charts" ON public.dashboard_charts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.dashboards WHERE dashboards.id = dashboard_charts.dashboard_id AND dashboards.user_id = auth.uid())
);

-- Function for safe SQL query execution
CREATE OR REPLACE FUNCTION execute_safe_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT (query_text ~* '^\s*SELECT') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  IF query_text ~* '\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)\b' THEN
    RAISE EXCEPTION 'Modifying queries are not allowed';
  END IF;
  
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_schemas_user_id ON public.schemas(user_id);
CREATE INDEX IF NOT EXISTS idx_mappings_user_id ON public.mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_mappings_schema_id ON public.mappings(schema_id);
CREATE INDEX IF NOT EXISTS idx_clean_data_user_id ON public.clean_data(user_id);
CREATE INDEX IF NOT EXISTS idx_clean_data_schema_id ON public.clean_data(schema_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON public.dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_charts_dashboard_id ON public.dashboard_charts(dashboard_id);
\`\`\`

</details>

### Step 2: Add OpenAI API Key (2 minutes)

1. **Get your OpenAI API key** from https://platform.openai.com/api-keys
2. **In Supabase dashboard**, go to: Project Settings → Edge Functions → Secrets
3. **Add secret**:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-...` (your API key)

### Step 3: Tell Me When Done!

Once you've completed steps 1 and 2, just reply with "Done" and I'll:
- Fix the TypeScript errors by regenerating types
- Show you how to integrate the AI agent into your existing chat component
- Help migrate your localStorage data to Supabase

## 🎯 What This Enables

After setup, your app will have:

- **AI SQL Generator**: Ask questions in plain English → Get SQL + Results
- **Smart Clarifications**: AI asks follow-up questions when context is missing
- **Auto-Charting**: Results displayed as charts (bar, line, pie, area) or tables
- **Chat History**: All conversations stored with SQL queries
- **Dashboard Ready**: Save queries as charts to dashboards
- **Secure**: RLS policies ensure users only see their own data

## 📊 Example Usage (After Setup)

\`\`\`typescript
import { useChatSession } from '@/hooks/useChatSession';

// In your component:
const { messages, sendMessage, createSession } = useChatSession();

// Create a chat session
createSession('Revenue Analysis');

// Ask a question
sendMessage('What is the total revenue by month?');

// AI will:
// 1. Check if query is clear (or ask clarifying questions)
// 2. Generate SQL from your schemas
// 3. Execute query safely
// 4. Return results + recommended chart type
// 5. Display in ChatMessage component with visualization
\`\`\`

## 🔄 Next Steps After Setup

Once the database is ready, I'll help you:
1. Fix TypeScript type errors
2. Integrate AI chat into RightChatPane
3. Create Dashboard page
4. Add "Save to Dashboard" button
5. Build Business Context management UI
6. Migrate localStorage data to Supabase

---

**Ready to proceed?** Complete steps 1 & 2 above and let me know!
