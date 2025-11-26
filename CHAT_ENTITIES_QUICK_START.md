# Quick Setup: Chat Entity Mentions

## What's New?
Your Ask AI chat now supports smart autocomplete for entities and metrics:
- Type `@` to mention hotels, operators, and legal entities
- Type `~` to mention metrics

## Setup Steps

### 1. Apply Database Migration
Run the migration to create the `chat_entities` table:

```bash
# Using Supabase CLI (recommended)
supabase db push

# Or manually apply through Supabase Dashboard:
# Go to SQL Editor and run: supabase/migrations/20251127000000_create_chat_entities_table.sql
```

### 2. Add Your First Entities
1. Navigate to **Project Config** in your app
2. Click the **"Chat Entities"** tab
3. Click **"Add New"**
4. Fill in the details:
   - Name: e.g., "Grand Hotel"
   - Type: Choose Hotel, Operator, Legal Entity, or Metric
   - Description: (optional) Add notes

### 3. Try It Out!
1. Go to **Ask AI** page
2. Start typing a message
3. Type `@` and see your entities appear
4. Type `~` to see your metrics
5. Use arrow keys to navigate, Enter to select

## Quick Examples

### Add Sample Entities
Via UI or SQL:

```sql
-- Hotels
INSERT INTO chat_entities (user_id, name, type, description)
VALUES 
  (auth.uid(), 'Grand Plaza Hotel', 'hotel', 'Downtown flagship property'),
  (auth.uid(), 'Seaside Resort', 'hotel', 'Beach resort property'),
  (auth.uid(), 'Airport Inn', 'hotel', 'Business travel focused');

-- Metrics
INSERT INTO chat_entities (user_id, name, type, description)
VALUES 
  (auth.uid(), 'Total Revenue', 'metric', 'All revenue streams combined'),
  (auth.uid(), 'Occupancy Rate', 'metric', 'Percentage of rooms occupied'),
  (auth.uid(), 'ADR', 'metric', 'Average Daily Rate'),
  (auth.uid(), 'RevPAR', 'metric', 'Revenue Per Available Room');

-- Operators
INSERT INTO chat_entities (user_id, name, type, description)
VALUES 
  (auth.uid(), 'Hospitality Corp', 'operator', 'Main hotel operator'),
  (auth.uid(), 'Resort Management Inc', 'operator', 'Resort specialist');
```

### Test Queries
```
Show me ~Total Revenue for @Grand Plaza Hotel
Compare @Grand Plaza Hotel and @Seaside Resort
What's the ~Occupancy Rate trend?
Show ~ADR for all properties operated by @Hospitality Corp
```

## Keyboard Shortcuts in Chat
- `↑` `↓` - Navigate suggestions
- `Enter` or `Tab` - Select suggestion
- `Esc` - Close dropdown
- Start typing to filter results

## Features at a Glance
✅ Autocomplete dropdown with search
✅ Visual icons for each entity type
✅ Full CRUD interface in Project Config
✅ User-specific entities (multi-tenant safe)
✅ Fast search with indexed queries
✅ Keyboard navigation support

## Files Created
- Database: `supabase/migrations/20251127000000_create_chat_entities_table.sql`
- Hook: `src/hooks/useChatEntities.ts`
- Components:
  - `src/components/chat/ChatInputWithMentions.tsx`
  - `src/components/chat/MentionDropdown.tsx`
  - `src/components/chat/ChatEntitiesManager.tsx`
- Updated: `src/pages/AskAI.tsx`, `src/pages/ProjectConfig.tsx`

## Documentation
See [CHAT_ENTITY_MENTIONS_GUIDE.md](./CHAT_ENTITY_MENTIONS_GUIDE.md) for complete documentation.

## Troubleshooting

**Dropdown not showing?**
- Check migration applied: `supabase db remote commit`
- Verify you're logged in
- Create at least one entity first

**Can't save entities?**
- Check Supabase connection
- Verify you have internet connection
- Check browser console for errors

**Need help?**
See the full guide: [CHAT_ENTITY_MENTIONS_GUIDE.md](./CHAT_ENTITY_MENTIONS_GUIDE.md)
