# RevSense v11 - Repository Overview

This is a **full-stack data analytics and AI-powered business intelligence platform** built specifically for hospitality/hotel revenue management.

---

## 🏗️ Architecture Overview

### Technology Stack

- **Frontend**: React + TypeScript + Vite
- **UI Framework**: shadcn-ui components + Tailwind CSS
- **Backend**: Supabase (PostgreSQL database + Edge Functions)
- **AI Integration**: OpenAI GPT-4.1 for natural language query processing
- **State Management**: React Query (@tanstack/react-query)
- **Charts**: Recharts for data visualization

---

## 📁 Repository Structure

```
revsense_v11/
├── src/                          # Frontend React application
│   ├── pages/                    # Main application pages
│   │   ├── SignUp.tsx           # Authentication
│   │   ├── Dashboard.tsx        # Main dashboard container
│   │   ├── AskAI.tsx           # AI chat interface (core feature)
│   │   ├── ProjectConfig.tsx    # Schema & mapping configuration
│   │   ├── AddData.tsx         # Excel upload & data mapping
│   │   ├── BatchProcess.tsx    # Batch data processing
│   │   ├── ConsolidatedData.tsx # View consolidated data
│   │   └── Dashboards.tsx      # Custom dashboard creation
│   ├── components/              # Reusable UI components
│   │   ├── chat/               # Chat interface components
│   │   ├── excel/              # Excel viewer/processor
│   │   ├── mapping/            # Data mapping UI
│   │   ├── schema/             # Schema management
│   │   ├── business/           # Business logic editor
│   │   ├── charts/             # Chart components
│   │   ├── dashboard/          # Dashboard-specific components
│   │   ├── layout/             # Navigation & layout components
│   │   └── ui/                 # shadcn-ui components
│   ├── hooks/                   # Custom React hooks
│   │   ├── useChatSession.ts   # Chat session management
│   │   ├── useDashboards.ts    # Dashboard CRUD operations
│   │   └── useDashboardCharts.ts # Chart operations
│   ├── contexts/               # React contexts
│   │   ├── ExcelContext.tsx    # Excel data state
│   │   └── AuthContext.tsx     # Authentication state
│   └── integrations/           # External integrations
│       └── supabase/           # Supabase client setup
├── supabase/                    # Backend infrastructure
│   └── functions/              # Edge Functions (serverless)
│       ├── ai-sql-orchestrator/ # Main AI query processor
│       ├── ai-chart-generator/  # Chart generation
│       ├── ai-sql-gen/         # SQL generation
│       ├── ai-formula/         # Formula processing
│       └── insert-clean-data/  # Data insertion
└── public/                      # Static assets
```

---

## 🎯 What Does It Achieve?

**RevSense is a conversational BI platform** that allows users to:

1. **Upload Excel data** from various sources (hotel financials, revenue reports)
2. **Map messy data** to clean, standardized schemas
3. **Ask questions in natural language** about their data
4. **Get AI-generated insights** with SQL queries, charts, and summaries
5. **Create custom dashboards** for monitoring KPIs

---

## 🤖 How the AI Agent Works

The core intelligence is in the **AI SQL Orchestrator** (`supabase/functions/ai-sql-orchestrator/index.ts`):

### Workflow

```
User Question → Clean Intent → Entity Resolution → SQL Generation → Execution → Summary
```

### Step-by-step Process

1. **Clean Intent Extraction** (GPT-4.1)
   - Parses user's natural language question
   - Extracts: entities (hotels), metrics (RevPAR, occupancy), time periods

2. **Entity Resolution**
   - Fuzzy matches hotel names, operators, legal entities
   - Uses Levenshtein distance for typo correction
   - Asks clarifying questions if ambiguous

3. **Metric Resolution**
   - Maps user terms (e.g., "revenue") to canonical metrics
   - Uses business context from `business-context.md`

4. **Query Classification** (GPT-4.1)
   - Determines if query is clear or needs clarification

5. **SQL Generation** (GPT-4.1)
   - Generates PostgreSQL queries in **canonical long format**
   - Each row: `(period, entity_name, metric_name, metric_value, metric_type)`

6. **Safe Execution**
   - Runs query through `execute_safe_query()` function
   - Blocks dangerous operations (INSERT, DELETE, DROP)

7. **Natural Language Summary** (GPT-4.1)
   - Converts results into human-readable insights

8. **Chart Suggestion** (Optional)
   - Recommends chart types (bar, line, combo)
   - Generates Recharts configuration

---

## 💬 How Users Interact

### 1. Data Setup Phase

```
User → Upload Excel → Map Columns → Define Schema → Save to Clean Tables
```

- Navigate to **Add Data** page
- Upload `.xlsx` file
- Map Excel columns to schema fields (e.g., "Total Rev" → `total_revenue`)
- Save mapping for reuse
- Data gets inserted into Supabase `clean_*` tables

### 2. Configuration Phase

```
User → Project Config → Define Schemas + Business Context + Chat Entities
```

- **Schemas Tab**: Define table structures (e.g., `clean_hotel_financials`)
- **Business Logic Tab**: Edit `business-context.md` with metric definitions
- **Chat Entities Tab**: Manage entity mentions for AI (@hotel, ~metric)

### 3. Query Phase

```
User → Ask AI → Type Question → Get Answer with Chart
```

**Example interaction:**
```
User: "Show me RevPAR for JW Marriott Pune over last 5 quarters"

AI Response:
- SQL Query: [Generated SELECT statement]
- Chart: Line chart showing RevPAR trend
- Summary: "RevPAR peaked at ₹12,387 in Q1 2025..."
```

### 4. Dashboard Phase

```
User → Dashboards → Create Custom Dashboard → Add Charts
```

- Combine multiple charts
- Save dashboard configurations
- Share with team

---

## 🗄️ Database Schema

### Key Tables

- `clean_hotel_master` - Hotel entity data (name, operator, legal entity)
- `clean_hotel_financials` - Financial metrics by period
- `clean_currency_exchange_rates` - Currency conversion rates
- `chat_sessions` - User chat history
- `chat_messages` - Individual messages with SQL/charts
- `schemas` - User-defined table schemas
- `mappings` - Excel-to-schema field mappings
- `dashboards` - User-created dashboards
- `dashboard_charts` - Charts within dashboards

---

## 🔐 Security Model

- **Authentication**: Supabase Auth (email/password)
- **Row-Level Security**: Users only see their own data
- **SQL Safety**: `execute_safe_query()` blocks write operations
- **Edge Functions**: Run with `SECURITY DEFINER` for controlled access

---

## 📊 Key Features

✅ **Excel Upload & Mapping** - Transform messy spreadsheets into clean data  
✅ **Natural Language Queries** - "Show me top 3 hotels by GOP"  
✅ **Entity Resolution** - Fuzzy matching with auto-correct  
✅ **Chart Generation** - Auto-suggest visualizations  
✅ **Session History** - Save and resume conversations  
✅ **Custom Dashboards** - Build KPI monitoring views  
✅ **Batch Processing** - Upload multiple files at once  

---

## 🚀 How to Use (Developer Perspective)

1. **Clone & Install:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   - Set up `.env` with Supabase credentials
   - Add OpenAI API key

3. **Run Development Server:**
   ```bash
   npm run dev
   ```

4. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy ai-sql-orchestrator
   ```

---

## 📝 Key Configuration Files

- `config.md` - Sample chart configuration
- `chartsettings.md` - Chart customization guide
- `UPDATE_SAFE_QUERY_INSTRUCTIONS.md` - SQL safety documentation
- `business-context.md` - Stored in Supabase Storage, defines metrics

---

## 📊 Dashboard UI Structure

### Main Layout Architecture

#### 1. Root Dashboard Container
**File:** `src/pages/Dashboard.tsx`

Simple layout wrapper with 3 components:
- `<TopNavbar />` - Header with logo & user menu
- `<LeftNavbar />` - Sidebar navigation
- `<Outlet />` - Child routes render here

### Navigation Components

#### 2. Top Navigation Bar
**File:** `src/components/layout/TopNavbar.tsx`

**Functions:**
- `getInitials(email)` - Extracts user initials for avatar
- Displays "RevSense" branding with Sparkles icon
- User dropdown menu with Settings/Profile/Sign Out

**Key Features:**
- User authentication context (`useAuth()`)
- Avatar with user initials
- Dropdown menu for account actions

#### 3. Left Sidebar Navigation
**File:** `src/components/layout/LeftNavbar.tsx`

**State:**
- `collapsed` - Boolean to toggle sidebar width (64px vs 256px)

**Navigation Items:**
- Ask AI
- Dashboards
- Project Config
- Add Data
- Batch Process
- Consolidated Data

**Functions:**
- Uses React Router's `NavLink` for active state styling
- Collapse/expand toggle button

#### 4. Secondary Tabs Component
**File:** `src/components/layout/SecondaryTabs.tsx`

**Props:**
- `tabs: string[]` - Array of tab names
- `activeTab: string` - Currently selected tab
- `onTabChange: (tab) => void` - Callback when tab changes

**Used by:** ProjectConfig, Dashboards pages for sub-navigation

### Dashboards Page (Main Dashboard UI)

#### 5. Dashboards Container
**File:** `src/pages/Dashboards.tsx`

**State Variables:**
```typescript
const [showCreateDialog, setShowCreateDialog] = useState(false)
const [showEditDialog, setShowEditDialog] = useState(false)
const [showAddChartDialog, setShowAddChartDialog] = useState(false)
const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
const [editingChart, setEditingChart] = useState<any>(null)
const [duplicatingChart, setDuplicatingChart] = useState<{id, title}>(null)
const [activeDashboard, setActiveDashboard] = useState<string>('')
```

**Key Functions:**

1. **`handleCreateDashboard(data)`**
   - Creates new dashboard with name & description
   - Calls `createDashboard()` mutation

2. **`handleMoveChart(chartId, direction)`**
   - Reorders charts within dashboard (up/down)
   - Updates position values in database

3. **`handleEditChartConfig(chart)`**
   - Opens chart configuration dialog
   - Allows editing SQL, chart type, axes, filters

4. **`handleDuplicateChart(chart)`**
   - Duplicates chart to same or different dashboard

5. **`handleDeleteDashboard()`**
   - Confirms deletion with user
   - Switches to another dashboard after deletion

6. **`handleEditDashboard(data)`**
   - Updates dashboard name/description

7. **`handleMoveDashboard(direction)`**
   - Reorders dashboard tabs (next/previous)

**Hooks Used:**
- `useDashboards()` - Dashboard CRUD operations
- `useDashboardCharts(activeDashboard)` - Chart operations for active dashboard

### Dashboard Components

#### 6. Dashboard Chart Item
**File:** `src/components/dashboard/DashboardChartItem.tsx`

**State:**
```typescript
const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
const [isEditing, setIsEditing] = useState(false)
const [editedTitle, setEditedTitle] = useState(initialTitle)
const [showSQL, setShowSQL] = useState(false)
const [showDeleteDialog, setShowDeleteDialog] = useState(false)
const [refreshedData, setRefreshedData] = useState(config?.lastResult)
const [filterValues, setFilterValues] = useState<Record<string, any>>({})
const [tableFormat, setTableFormat] = useState<'pivot' | 'long'>('pivot')
```

**Key Functions:**

1. **`replacePlaceholders(sql, filterValues)`**
   - Replaces filter placeholders in SQL (e.g., `{[hotel]}` → `'Hotel A', 'Hotel B'`)
   - Handles arrays, date ranges, text values

2. **`handleRefresh()`**
   - Executes SQL query with current filter values
   - Updates chart data via `refreshChart()` mutation

3. **`handleSaveTitle()`**
   - Updates chart title in database

4. **`handleDelete()`**
   - Removes chart from dashboard

**Features:**
- **View Toggle:** Switch between chart/table view
- **Table Format:** Pivot vs Long format for canonical data
- **Filters:** Dynamic filters with auto-refresh
- **Chart Actions:** Move up/down, refresh, edit, duplicate, delete
- **SQL Viewer:** Collapsible SQL query display

#### 7. Other Dashboard Components

**`src/components/dashboard/CreateDashboardDialog.tsx`**
- Form dialog for creating new dashboards
- Fields: name, description

**`src/components/dashboard/AddChartDialog.tsx`**
- Comprehensive chart configuration dialog
- SQL editor, chart type selector, axis configuration
- Filter builder, series configuration

**`src/components/dashboard/DuplicateChartDialog.tsx`**
- Dialog to duplicate chart to another dashboard

**`src/components/dashboard/ChartFilters.tsx`**
- Renders dynamic filter inputs based on chart config
- Supports: text, select, multi-select, date range

### Custom Hooks (Data Layer)

#### 8. useDashboards Hook
**File:** `src/hooks/useDashboards.ts`

**Exported Functions:**
```typescript
{
  dashboards,              // Array of Dashboard objects
  isLoading,              // Loading state
  createDashboard,        // (data) => void
  updateDashboard,        // ({id, name, description}) => void
  deleteDashboard,        // (id) => void
  reorderDashboards,      // (updates[]) => void
  isCreating,             // Boolean
  isUpdating,             // Boolean
  isDeleting,             // Boolean
  isReordering,           // Boolean
}
```

**Database Table:** `dashboards`  
**Columns:** `id`, `name`, `description`, `created_at`, `user_id`, `position`

#### 9. useDashboardCharts Hook
**File:** `src/hooks/useDashboardCharts.ts`

**Exported Functions:**
```typescript
{
  charts,                 // Array of DashboardChart objects
  isLoading,             // Loading state
  addChart,              // (chart) => void
  updateChart,           // ({id, title?, config?, position?, sql_query?}) => void
  deleteChart,           // (id) => void
  duplicateChart,        // ({chartId, targetDashboardId, newTitle?}) => void
  refreshChart,          // ({id, sql_query}) => Promise<data>
  reorderCharts,         // (updates[]) => void
  isAdding,              // Boolean
  isUpdating,            // Boolean
  isDeleting,            // Boolean
  isDuplicating,         // Boolean
  isRefreshing,          // Boolean
  isReordering,          // Boolean
}
```

**Database Table:** `dashboard_charts`  
**Columns:** `id`, `dashboard_id`, `title`, `sql_query`, `chart_type`, `config`, `position`, `created_at`

**Key Mutation:**
- `refreshChart()` - Executes SQL via `execute_safe_query` RPC, updates `config.lastResult` and `config.lastRefreshed`

### UI Flow Diagram

```
User Opens /dashboard/dashboards
         ↓
   Dashboards.tsx loads
         ↓
   useDashboards() fetches all dashboards
         ↓
   Sets activeDashboard to first dashboard
         ↓
   useDashboardCharts(activeDashboard) fetches charts
         ↓
   Renders SecondaryTabs with dashboard names
         ↓
   For each chart, renders DashboardChartItem
         ↓
   User can:
   - Switch dashboards (tabs)
   - Create/Edit/Delete dashboards
   - Add charts (opens AddChartDialog)
   - Reorder charts (up/down buttons)
   - Refresh chart data (executes SQL)
   - Toggle chart/table view
   - Apply filters (auto-refresh)
   - Edit chart config (SQL, type, axes)
   - Duplicate chart to another dashboard
```

### Database Schema for Dashboards

**Dashboards Table:**
```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER,
  created_at TIMESTAMP
)
```

**Dashboard Charts Table:**
```sql
CREATE TABLE dashboard_charts (
  id UUID PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards,
  title TEXT NOT NULL,
  sql_query TEXT NOT NULL,
  chart_type TEXT, -- 'bar', 'line', 'pie', 'area', 'combo', 'table'
  config JSONB,    -- Stores chart config, filters, lastResult, lastRefreshed
  position INTEGER,
  created_at TIMESTAMP
)
```

### Summary: Key Files & Their Roles

| File | Role | Key Functions |
|------|------|---------------|
| `Dashboard.tsx` | Root layout | Renders TopNavbar + LeftNavbar + Outlet |
| `TopNavbar.tsx` | Header | User menu, branding |
| `LeftNavbar.tsx` | Sidebar | Main navigation, collapse toggle |
| `SecondaryTabs.tsx` | Sub-navigation | Reusable tab component |
| `Dashboards.tsx` | Dashboard manager | CRUD dashboards, switch tabs, manage charts |
| `DashboardChartItem.tsx` | Chart display | Render chart/table, filters, refresh, reorder |
| `AddChartDialog.tsx` | Chart editor | Configure SQL, type, axes, filters |
| `ChartFilters.tsx` | Filter inputs | Dynamic filter rendering |
| `useDashboards.ts` | Dashboard data | Fetch/create/update/delete dashboards |
| `useDashboardCharts.ts` | Chart data | Fetch/add/update/delete/refresh charts |

---

This architecture provides a **modular, data-driven dashboard system** where:
- Dashboards are containers for charts
- Charts execute SQL queries and display results
- Filters dynamically modify SQL queries
- All state is managed via React Query with Supabase backend
- UI components are cleanly separated from data logic
