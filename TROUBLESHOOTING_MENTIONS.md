# Troubleshooting: Chat Entity Mentions Not Appearing

## Issue: Dropdown doesn't appear when typing @ or ~

### Step 1: Check Browser Console

Open your browser's Developer Tools (F12) and look for console messages when you type `@` in the chat:

**Expected console output when typing `@`:**
```
📝 Input changed: { newValue: '@', cursorPos: 1 }
✅ Found trigger: { trigger: '@', mentionPos: 0, i: 0 }
🎯 Setting mention state: { trigger: '@', searchText: '', mentionPos: 0 }
🔍 Mention Debug: { showMentions: true, mentionType: '@', ... }
🔎 useEntitySearch called: { searchQuery: '', type: ['hotel', 'operator', 'legal_entity'] }
```

### Step 2: Check for Common Errors

#### Error: "relation 'chat_entities' does not exist"
**Problem:** Table hasn't been created yet
**Solution:** Apply the database migration

```sql
-- Go to Supabase Dashboard → SQL Editor
-- Paste and run the migration from:
supabase/migrations/20251127000000_create_chat_entities_table.sql
```

#### Error: "No user authenticated"
**Problem:** User not logged in
**Solution:** Make sure you're logged in to the application

#### Console shows: "✅ Entity search results: []"
**Problem:** Table exists but is empty
**Solution:** Add entities via Project Config → Chat Entities tab

### Step 3: Run Diagnostic

The diagnostic component will automatically check:
1. ✅ If you're authenticated
2. ✅ If the `chat_entities` table exists
3. ✅ If there are any entities in the table

Look for messages starting with 🔧 in your console.

### Step 4: Verify Table Creation

#### Via Supabase Dashboard:
1. Go to **Table Editor**
2. Look for `chat_entities` table
3. Check if it has the correct columns:
   - id (uuid)
   - user_id (uuid)
   - name (text)
   - type (text)
   - description (text, nullable)
   - created_at (timestamptz)
   - updated_at (timestamptz)

#### Via SQL:
```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'chat_entities'
);

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_entities';

-- Check your entities
SELECT * FROM chat_entities WHERE user_id = auth.uid();
```

### Step 5: Add Test Entity

Try adding a test entity manually:

```sql
INSERT INTO chat_entities (user_id, name, type, description)
VALUES (
  auth.uid(),
  'Test Hotel',
  'hotel',
  'Test entry for debugging'
);
```

Then try typing `@` in the chat again.

### Step 6: Check Component Rendering

Look for these console logs when you type `@`:

```
✅ Found trigger: { trigger: '@', ... }  ← Input detected @
🎯 Setting mention state: ...            ← State being set
🔍 Mention Debug: { showMentions: true } ← Should show dropdown
🔎 useEntitySearch called: ...           ← Query running
✅ Entity search results: [...]          ← Results returned
```

If any of these are missing, note which one and check that step.

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| No console logs at all | Component not imported correctly - check AskAI.tsx |
| "Table does not exist" error | Apply migration via Supabase Dashboard |
| Empty results array | Add entities via Project Config |
| Dropdown flashes then disappears | May be z-index issue - check CSS |
| Can't type @ symbol | Keyboard layout or input blocked |

### Quick Fixes

#### 1. Clear React Query Cache
```javascript
// In browser console:
localStorage.clear();
location.reload();
```

#### 2. Check if types updated
Make sure TypeScript types are current:
```bash
# Restart your dev server
npm run dev
# or
bun run dev
```

#### 3. Verify RLS Policies
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'chat_entities';

-- Should return: rowsecurity = true
```

### Still Not Working?

1. **Check these files exist:**
   - `src/components/chat/ChatInputWithMentions.tsx`
   - `src/components/chat/MentionDropdown.tsx`
   - `src/hooks/useChatEntities.ts`

2. **Verify imports in AskAI.tsx:**
   ```typescript
   import { ChatInputWithMentions } from '@/components/chat/ChatInputWithMentions';
   ```

3. **Check for TypeScript errors:**
   ```bash
   npm run build
   # or
   bun run build
   ```

4. **Look at Network tab:**
   - Open DevTools → Network
   - Type `@` in chat
   - Look for request to `/rest/v1/chat_entities`
   - Check if it returns 200 or error

### Debug Mode

Copy this to browser console to enable verbose logging:
```javascript
localStorage.setItem('debug', 'chat-mentions');
```

### Contact Info in Logs

When the diagnostic runs, you'll see:
- 🔧 Diagnostic starting
- ✅ Checks that pass
- ❌ Checks that fail
- 💡 Suggestions for fixes

Share the console output if you need help debugging!
