-- Make user_id NOT NULL in business_context table
ALTER TABLE public.business_context 
ALTER COLUMN user_id SET NOT NULL;