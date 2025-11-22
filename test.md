# End-to-End Test Plan: Coffee D2C Business (Single Record Mapping)

## Test Scenario: "Bean & Brew Coffee Co. - Monthly Summary Reports"
A small direct-to-consumer coffee brand that uploads one Excel workbook per month containing aggregated monthly performance data.

---

## 1. Test Data Overview

### Business Context
- **Company**: Bean & Brew Coffee Co.
- **Business Model**: D2C coffee subscription and one-time purchases
- **Products**: Various coffee blends (Espresso, Medium Roast, Dark Roast, Decaf)
- **Geography**: US-based, ships nationwide
- **Data Cadence**: One workbook uploaded per month with monthly KPIs
- **Mapping Type**: Single record extraction (one Excel file → one database record)

---

## 2. Test Execution Steps

### Phase 1: Initial Setup & Authentication

**Step 1.1: Sign Up**
1. Navigate to the application
2. Click "Sign Up"
3. Create account with:
   - Email: `test@beanbrew.com`
   - Password: `TestPassword123!`
4. ✅ **Expected**: Successfully logged in, redirected to Dashboard

**Step 1.2: Navigate to Project Config**
1. Click on "Config" in the left navigation
2. ✅ **Expected**: See three tabs - Schemas, Mappings, Business Logic

---

### Phase 2: Create Schema Definition

**Step 2.1: Create Monthly Performance Schema**
1. Go to "Schemas" tab
2. Click "Create New Schema"
3. Fill in schema details:
   - **Name**: `Monthly Performance Summary`
   - **Description**: `Schema for tracking monthly aggregated KPIs from coffee sales`

4. Add the following fields:

| Field Name | Field Type | Required | Description |
|------------|------------|----------|-------------|
| report_month | text | Yes | Month identifier (e.g., "2025-01", "Jan 2025") |
| total_orders | number | Yes | Total number of orders in the month |
| total_revenue | currency | Yes | Total revenue for the month |
| avg_order_value | currency | Yes | Average order value |
| subscription_orders | number | Yes | Number of subscription orders |
| one_time_orders | number | Yes | Number of one-time orders |
| top_product | text | Yes | Best-selling product name |
| top_product_revenue | currency | Yes | Revenue from top product |
| new_customers | number | Yes | Count of new customers |
| returning_customers | number | Yes | Count of returning customers |
| fulfillment_rate | number | Yes | % of orders successfully delivered |
| top_state | text | No | State with most orders |

5. Click "Save Schema"
6. ✅ **Expected**: Schema created successfully, visible in schema list

---

### Phase 3: Define Business Context

**Step 3.1: Add Growth Metrics Context**
1. Go to "Business Logic" tab
2. Click "Add Business Context"
3. Fill in:
   - **Context Type**: `formula`
   - **Name**: `Growth Rate Calculation`
   - **Definition**: `Month-over-month growth rate is calculated as ((current_month - previous_month) / previous_month) × 100. Applies to revenue, orders, and customer metrics.`
   - **Examples**: 
     - `What is our revenue growth rate?`
     - `Show month-over-month order growth`

4. Click "Save"
5. ✅ **Expected**: Business context saved successfully

**Step 3.2: Add Customer Retention Context**
1. Click "Add Business Context"
2. Fill in:
   - **Context Type**: `entity`
   - **Name**: `Customer Retention`
   - **Definition**: `Returning customers are those who have placed orders in previous months. New customers are first-time buyers. Retention rate = (returning_customers / total_customers) × 100.`
   - **Examples**: 
     - `What is our customer retention rate?`
     - `How many new customers did we acquire last month?`

3. Click "Save"
4. ✅ **Expected**: Business context saved successfully

**Step 3.3: Add Subscription Business Model Context**
1. Click "Add Business Context"
2. Fill in:
   - **Context Type**: `relationship`
   - **Name**: `Subscription vs One-Time Mix`
   - **Definition**: `Subscription orders provide recurring revenue and are more valuable than one-time purchases. Target mix is 60% subscription, 40% one-time. Subscription ratio = (subscription_orders / total_orders) × 100.`
   - **Examples**: 
     - `What percentage of orders are subscriptions?`
     - `Are we meeting our subscription target mix?`

3. Click "Save"
4. ✅ **Expected**: 3 business contexts now visible in list

---

### Phase 4: Upload & Map Excel Data (Single Record)

**Step 4.1: Navigate to Add Data**
1. Click on "Add Data" in the left navigation
2. ✅ **Expected**: See Excel upload interface and mapping creation pane

**Step 4.2: Upload Monthly Summary Excel File**
1. Upload the file: `january_2025_summary.xlsx`
2. ✅ **Expected**: Excel data loads in viewer with "Summary" sheet visible
3. ✅ **Expected**: Preview shows summary report with KPIs in specific cells

**Step 4.3: Create Single-Record Field Mapping**
1. In the "Create Mapping" pane on the right:
   - **Mapping Name**: `Monthly Summary Report Mapping`
   - **Description**: `Extracts KPIs from monthly summary Excel report - one record per month`
   - **Tags**: `monthly`, `kpi`, `summary`
   - **Select Schema**: `Monthly Performance Summary`

2. Map Excel cells to schema fields (single cell references):

| Schema Field | Formula/Cell Reference | Example Value |
|--------------|------------------------|---------------|
| report_month | =Summary!B2 | "January 2025" |
| total_orders | =Summary!B4 | 127 |
| total_revenue | =Summary!B5 | 18450.00 |
| avg_order_value | =Summary!B6 | 145.28 |
| subscription_orders | =Summary!B8 | 78 |
| one_time_orders | =Summary!B9 | 49 |
| top_product | =Summary!B11 | "Espresso Blend" |
| top_product_revenue | =Summary!B12 | 6200.00 |
| new_customers | =Summary!B14 | 42 |
| returning_customers | =Summary!B15 | 35 |
| fulfillment_rate | =Summary!B17 | 96.5 |
| top_state | =Summary!B18 | "California" |

3. Click "Test Formula" for each field to verify extraction
4. ✅ **Expected**: All formulas compute successfully, show preview values
5. Click "Create Mapping"
6. ✅ **Expected**: Mapping created successfully, toast notification appears

**Step 4.4: Apply Mapping & Extract Single Record**
1. Select the mapping "Monthly Summary Report Mapping"
2. Click "Apply Mapping"
3. ✅ **Expected**: Mapping Application Pane opens showing all 12 fields
4. Review the computed values in the preview table
5. ✅ **Expected**: All fields show valid values with green checkmarks
6. Click "Save to Clean Table"
7. ✅ **Expected**: Success toast: "1 record saved to clean_data table"

---

### Phase 5: View Consolidated Data

**Step 5.1: Navigate to Consolidated Data**
1. Click on "Consolidated Data" in the left navigation
2. ✅ **Expected**: See table with 1 record (January 2025 summary)
3. ✅ **Expected**: Data matches Excel summary cells with proper types

**Step 5.2: Verify Single Record Integrity**
1. Check that report_month shows "January 2025"
2. Verify total_orders = 127
3. Verify total_revenue shows as currency format ($18,450.00)
4. Verify fulfillment_rate = 96.5 (number, not percentage symbol)
5. ✅ **Expected**: All 12 fields extracted correctly

**Step 5.3: Upload Second Month**
1. Navigate back to "Add Data"
2. Upload `february_2025_summary.xlsx`
3. Select existing mapping "Monthly Summary Report Mapping"
4. Click "Apply Mapping" and "Save to Clean Table"
5. ✅ **Expected**: Second record added successfully
6. Navigate to "Consolidated Data"
7. ✅ **Expected**: Now see 2 records (January and February)

---

### Phase 6: AI Query Testing (Monthly Summary Data)

**Step 6.1: Open AI Chat**
1. From Dashboard, click the chat icon (bottom right)
2. ✅ **Expected**: Chat pane opens on the right side

**Step 6.2: Test Basic Revenue Query**
1. Ask: `What was our total revenue in January 2025?`
2. ✅ **Expected**: 
   - AI generates SQL query filtering by report_month
   - Returns $18,450.00
   - Displays natural language summary
   - Shows "View SQL", "View Table", "View Chart" buttons

**Step 6.3: Test Month-over-Month Comparison**
1. Ask: `Compare total orders between January and February`
2. ✅ **Expected**: 
   - AI queries both months
   - Shows comparison (e.g., "January: 127 orders, February: 134 orders")
   - Calculates growth if business context applied
   - Chat window remains open

**Step 6.4: Test Growth Rate Calculation**
1. Ask: `What is our month-over-month revenue growth from January to February?`
2. ✅ **Expected**: 
   - AI applies "Growth Rate Calculation" business context
   - Computes percentage change
   - Provides clear summary with %

**Step 6.5: Test Customer Retention Query**
1. Ask: `What was our customer retention rate in February?`
2. ✅ **Expected**: 
   - AI uses "Customer Retention" business context
   - Calculates (returning_customers / (new_customers + returning_customers)) × 100
   - Returns percentage value

**Step 6.6: Test Subscription Mix Analysis**
1. Ask: `Are we meeting our subscription target mix in January?`
2. ✅ **Expected**: 
   - AI applies "Subscription vs One-Time Mix" business context
   - Calculates (subscription_orders / total_orders) × 100
   - Compares to 60% target
   - Provides insight on whether target is met

**Step 6.7: Test Average Order Value Tracking**
1. Ask: `How has our average order value changed over the months?`
2. Click "View Chart"
3. ✅ **Expected**: 
   - Shows line chart of avg_order_value over time
   - Properly formatted with currency values
   - Trend is visible

**Step 6.8: Test Top Product Analysis**
1. Ask: `What was our best-selling product in January?`
2. ✅ **Expected**: 
   - Returns top_product field value ("Espresso Blend")
   - Shows top_product_revenue
   - Provides context

**Step 6.9: Test Multi-Month Aggregation**
1. Ask: `What is the total revenue across all months?`
2. ✅ **Expected**: 
   - AI sums total_revenue across all records
   - Returns aggregate value
   - Counts number of months included

**Step 6.10: Test Fulfillment Rate Query**
1. Ask: `What was our fulfillment rate in February?`
2. ✅ **Expected**: 
   - Returns fulfillment_rate value
   - Formats as percentage if needed
   - Provides performance assessment

**Step 6.11: Test Geographic Insights**
1. Ask: `Which state had the most orders each month?`
2. Click "View Table"
3. ✅ **Expected**: 
   - Shows report_month and top_state for each record
   - Table properly formatted
   - Data accurate

**Step 6.12: Test Chat History Persistence**
1. Close chat window
2. Reopen chat window
3. ✅ **Expected**: 
   - All previous messages still visible
   - Can continue conversation
   - Context is maintained

---

### Phase 7: Dashboard Visualization (Optional)

**Step 7.1: Create Dashboard**
1. Navigate to Dashboard tab
2. Create charts from previous queries
3. ✅ **Expected**: Charts persist and update properly

---

## 3. Test Data Details

### Excel Files: Monthly Summary Reports

**File 1: `january_2025_summary.xlsx`**
**Sheet: Summary**

| Cell | Label | Value |
|------|-------|-------|
| A2 | Report Month | B2: "January 2025" |
| A4 | Total Orders | B4: 127 |
| A5 | Total Revenue | B5: $18,450.00 |
| A6 | Avg Order Value | B6: $145.28 |
| A8 | Subscription Orders | B8: 78 |
| A9 | One-Time Orders | B9: 49 |
| A11 | Top Product | B11: "Espresso Blend" |
| A12 | Top Product Revenue | B12: $6,200.00 |
| A14 | New Customers | B14: 42 |
| A15 | Returning Customers | B15: 35 |
| A17 | Fulfillment Rate | B17: 96.5 |
| A18 | Top State | B18: "California" |

**File 2: `february_2025_summary.xlsx`**
**Sheet: Summary**
- Same structure, different values for February
- Example: Total Orders: 134, Total Revenue: $19,780.00, etc.

---

## 4. Expected Business Insights (Single-Record Monthly Data)

After completing all tests, the system should be able to answer:

1. **Monthly Revenue Tracking**
   - Total revenue per month
   - Month-over-month growth rate
   - Cumulative revenue across all months

2. **Order Volume Trends**
   - Total orders per month
   - Growth in order volume
   - Subscription vs one-time order mix

3. **Customer Acquisition & Retention**
   - New customers each month
   - Returning customer count
   - Retention rate calculation

4. **Product Performance**
   - Top-selling product each month
   - Top product revenue contribution
   - Product consistency over time

5. **Operational Excellence**
   - Fulfillment rate per month
   - Fulfillment trends
   - Performance vs benchmarks

6. **Geographic Insights**
   - Top state by month
   - Geographic consistency
   - Regional patterns

---

## 5. Success Criteria

✅ All features work without errors
✅ Data extraction is accurate and complete
✅ AI generates correct SQL queries
✅ AI applies business context appropriately
✅ Visualizations render correctly
✅ Chat history persists across sessions
✅ Navigation maintains chat state
✅ All data types handled properly
✅ Edge cases handled gracefully

---

## 6. Known Issues & Limitations

- Document any issues encountered during testing
- Note any features that need improvement
- Track any edge cases not handled properly

---

## 7. Test Execution Log

| Test Step | Status | Notes | Timestamp |
|-----------|--------|-------|-----------|
| | | | |

---

## Notes for Tester

- Take screenshots of key steps
- Document actual vs expected results
- Report any deviations immediately
- Verify all timestamps and dates are in correct timezone
- Check that all toast notifications appear properly
- Ensure no console errors during execution
