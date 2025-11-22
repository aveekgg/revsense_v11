-- Add RLS policies for schemas table
CREATE POLICY "Users can view their own schemas"
ON public.schemas
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own schemas"
ON public.schemas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schemas"
ON public.schemas
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schemas"
ON public.schemas
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add RLS policies for business_context table
CREATE POLICY "Users can view their own business context"
ON public.business_context
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own business context"
ON public.business_context
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business context"
ON public.business_context
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business context"
ON public.business_context
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);