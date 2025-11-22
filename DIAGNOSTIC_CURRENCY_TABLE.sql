-- DIAGNOSTIC: Check currency_exchange_rates table status
-- Run this in Supabase SQL Editor to diagnose why table shows no records

-- 1. Check if table exists
SELECT 
    schemaname, 
    tablename, 
    tableowner 
FROM pg_tables 
WHERE tablename = 'clean_currency_exchange_rates';

-- 2. Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clean_currency_exchange_rates'
ORDER BY ordinal_position;

-- 3. Count total records in table (bypassing RLS)
SELECT COUNT(*) as total_records 
FROM public.clean_currency_exchange_rates;

-- 4. View actual records (bypassing RLS - as admin)
SELECT * 
FROM public.clean_currency_exchange_rates 
LIMIT 10;

-- 5. Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'clean_currency_exchange_rates';

-- 6. Check RLS policies on the table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'clean_currency_exchange_rates';

-- 7. Check if your user has records (with RLS)
-- This simulates what the frontend sees
SELECT * 
FROM clean_currency_exchange_rates;

-- 8. Check user_id in the record
SELECT 
    id,
    user_id,
    extracted_at,
    source_workbook
FROM public.clean_currency_exchange_rates;

-- 9. Get current user ID
SELECT auth.uid() as current_user_id;

-- 10. Check if user_id matches
SELECT 
    id,
    user_id,
    user_id = auth.uid() as is_my_record,
    auth.uid() as current_user_id
FROM public.clean_currency_exchange_rates;
