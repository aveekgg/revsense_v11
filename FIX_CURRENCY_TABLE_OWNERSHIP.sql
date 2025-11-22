-- QUICK FIX: Make currency_exchange_rates records visible to current user
--
-- PROBLEM: Table has records but they don't show in Consolidated Data view
-- CAUSE: user_id in records doesn't match current logged-in user
--
-- SOLUTION: Update all records to belong to current user

-- Step 1: Check what's in the table now (as admin)
SELECT 
    id,
    user_id,
    extracted_at,
    source_workbook,
    -- Show all columns
    *
FROM public.clean_currency_exchange_rates;

-- Step 2: See your current user ID
SELECT auth.uid() as my_user_id;

-- Step 3: Update all records to belong to you
-- ⚠️ WARNING: This updates ALL records in the table to belong to you
UPDATE public.clean_currency_exchange_rates
SET user_id = auth.uid();

-- Step 4: Verify the update worked
SELECT 
    id,
    user_id,
    user_id = auth.uid() as is_mine,
    extracted_at
FROM public.clean_currency_exchange_rates;

-- Step 5: Test that you can now see the records (with RLS)
-- This simulates what the frontend will see
SELECT * FROM clean_currency_exchange_rates;

-- Expected Result: You should now see 1 record ✓
