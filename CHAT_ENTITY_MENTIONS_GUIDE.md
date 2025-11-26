# Chat Entity Mentions Feature

## Overview
The Ask AI chat now supports mentioning entities and metrics using special trigger characters:
- **`@`** - Mention hotels, operators, and legal entities
- **`~`** - Mention metrics

This feature provides autocomplete suggestions as you type, making it easy to include clean, consistent names in your queries.

## Features

### 1. Entity Mentions (`@`)
When you type `@` in the chat input, a dropdown appears with:
- Hotels
- Operators
- Legal Entities

**Example Usage:**
```
Show me revenue for @Grand Hotel last quarter
Compare @Hotel A and @Hotel B performance
What's the occupancy rate at @Downtown Property
```

### 2. Metric Mentions (`~`)
When you type `~` in the chat input, a dropdown appears with predefined metrics.

**Example Usage:**
```
Show me ~Total Revenue for last month
Compare ~Occupancy Rate across all hotels
What's the trend for ~Average Daily Rate
```

### 3. Autocomplete & Navigation
- Type `@` or `~` followed by text to filter suggestions
- Use **Arrow Keys** (↑/↓) to navigate through suggestions
- Press **Enter** or **Tab** to select
- Press **Esc** to close the dropdown
- Click on any suggestion to insert it

### 4. Visual Indicators
Each entity type has a unique icon and color:
- 🏢 **Hotels** - Blue
- 👤 **Operators** - Green
- 💼 **Legal Entities** - Purple
- 📈 **Metrics** - Orange

## Database Structure

### Table: `chat_entities`
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- name: TEXT (the entity/metric name)
- type: TEXT ('hotel', 'operator', 'legal_entity', 'metric')
- description: TEXT (optional description)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### Security
- Row Level Security (RLS) is enabled
- Users can only access their own entities
- All CRUD operations are scoped to the authenticated user

## Managing Entities

### Via Project Config UI
1. Navigate to **Project Config** in the sidebar
2. Click on the **"Chat Entities"** tab
3. Use the interface to:
   - **Add New**: Click the "Add New" button
   - **Edit**: Click the edit icon on any entity
   - **Delete**: Click the trash icon to remove an entity
   - **Filter**: Use the dropdown to filter by type

### Entity Fields
When creating/editing an entity:
- **Name** (required): The display name that will be inserted into chat
- **Type** (required): Choose between Hotel, Operator, Legal Entity, or Metric
  - *Note: Type cannot be changed after creation*
- **Description** (optional): Additional context or notes about the entity

## Implementation Details

### Files Created/Modified

#### 1. Database Migration
- **`supabase/migrations/20251127000000_create_chat_entities_table.sql`**
  - Creates `chat_entities` table
  - Sets up RLS policies
  - Creates indexes for performance
  - Adds triggers for automatic timestamp updates

#### 2. TypeScript Types
- **`src/integrations/supabase/types.ts`**
  - Added `chat_entities` table type definitions

#### 3. Custom Hook
- **`src/hooks/useChatEntities.ts`**
  - `useChatEntities()`: Main hook for CRUD operations
  - `useEntitySearch()`: Search/autocomplete functionality
  - Includes React Query integration for caching

#### 4. UI Components
- **`src/components/chat/MentionDropdown.tsx`**
  - Displays autocomplete suggestions
  - Shows keyboard shortcuts
  - Handles selection and navigation

- **`src/components/chat/ChatInputWithMentions.tsx`**
  - Custom input component with mention detection
  - Manages dropdown positioning
  - Handles keyboard navigation
  - Inserts selected entities into text

- **`src/components/chat/ChatEntitiesManager.tsx`**
  - Full CRUD interface for managing entities
  - Filtering by type
  - Create/Edit/Delete dialogs
  - List view with icons and badges

#### 5. Page Updates
- **`src/pages/AskAI.tsx`**
  - Replaced standard Input with ChatInputWithMentions
  - Updated placeholder text to indicate @ and ~ features

- **`src/pages/ProjectConfig.tsx`**
  - Added "Chat Entities" tab
  - Integrated ChatEntitiesManager component

## Usage Examples

### Example 1: Simple Entity Mention
```
User types: "Show revenue for @"
Dropdown appears with: Grand Hotel, Downtown Plaza, Beach Resort
User selects: Grand Hotel
Final message: "Show revenue for Grand Hotel"
```

### Example 2: Metric with Search
```
User types: "What's the ~rev"
Dropdown filters to: Total Revenue, RevPAR, Revenue Per Room
User selects: Total Revenue
Final message: "What's the Total Revenue"
```

### Example 3: Multiple Mentions
```
User types: "Compare ~Occupancy Rate at @Hotel A vs @Hotel B"
```

## API Reference

### useChatEntities Hook

```typescript
const {
  entities,           // ChatEntity[] - filtered list of entities
  isLoading,         // boolean - loading state
  error,             // Error | null
  createEntity,      // (input: CreateEntityInput) => void
  updateEntity,      // ({ id, input }: { id: string, input: UpdateEntityInput }) => void
  deleteEntity,      // (id: string) => void
  isCreating,        // boolean
  isUpdating,        // boolean
  isDeleting,        // boolean
} = useChatEntities(type?: EntityType | EntityType[]);
```

### useEntitySearch Hook

```typescript
const {
  entities,          // ChatEntity[] - search results
  isLoading,         // boolean
} = useEntitySearch(
  searchQuery: string,
  type?: EntityType | EntityType[]
);
```

### Types

```typescript
type EntityType = 'hotel' | 'operator' | 'legal_entity' | 'metric';

interface ChatEntity {
  id: string;
  user_id: string;
  name: string;
  type: EntityType;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface CreateEntityInput {
  name: string;
  type: EntityType;
  description?: string;
}

interface UpdateEntityInput {
  name?: string;
  description?: string;
}
```

## Migration Instructions

### 1. Apply Database Migration
```bash
# If using Supabase CLI
supabase db push

# Or apply the migration file directly through Supabase dashboard
```

### 2. Verify Table Creation
Check that the `chat_entities` table exists in your Supabase project with proper RLS policies.

### 3. Populate Sample Data (Optional)
You can add sample entities through the UI or directly in the database:

```sql
INSERT INTO chat_entities (user_id, name, type, description)
VALUES 
  (auth.uid(), 'Grand Hotel', 'hotel', 'Main downtown property'),
  (auth.uid(), 'Total Revenue', 'metric', 'Sum of all revenue streams'),
  (auth.uid(), 'ABC Corp', 'operator', 'Primary hotel operator');
```

## Testing Checklist

- [ ] Type `@` in chat - dropdown appears with entities
- [ ] Type `~` in chat - dropdown shows only metrics
- [ ] Arrow keys navigate the dropdown
- [ ] Enter/Tab inserts selected entity
- [ ] Esc closes dropdown
- [ ] Can create new entity via Project Config
- [ ] Can edit existing entity
- [ ] Can delete entity with confirmation
- [ ] Filter works in entity manager
- [ ] Entities are user-specific (RLS working)
- [ ] Search filters entities by name
- [ ] Multiple mentions work in same message

## Troubleshooting

### Dropdown Not Appearing
- Ensure migration has been applied
- Check browser console for errors
- Verify user is authenticated
- Check that entities exist in database

### Entities Not Saving
- Verify Supabase connection
- Check RLS policies are enabled
- Ensure user has valid session
- Check for unique constraint violations

### Performance Issues
- Indexed on `user_id` and `type` for fast queries
- Search limited to 10 results
- Debouncing could be added if needed

## Future Enhancements

Potential improvements:
1. **Bulk Import**: Import entities from CSV/Excel
2. **Entity Aliases**: Multiple names for same entity
3. **Entity Hierarchy**: Parent-child relationships
4. **Recent/Favorites**: Show frequently used entities first
5. **Entity Metadata**: Additional fields like location, category
6. **AI Suggestions**: Auto-suggest entities based on chat context
7. **Cross-reference**: Link entities to actual data tables
8. **Rich Tooltips**: Show entity stats on hover

## Related Documentation
- [Ask AI Chat Feature](./README_AI_IMPLEMENTATION.md)
- [Supabase Setup](./SETUP_INSTRUCTIONS.md)
- [Database Schema](./ARCHITECTURE.md)
