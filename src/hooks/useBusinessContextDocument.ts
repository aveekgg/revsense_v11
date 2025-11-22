import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const BUCKET_NAME = 'business-context-docs';
const FILE_NAME = 'business-context.md';

const DEFAULT_TEMPLATE = `# Business Context

Welcome! This document helps the AI understand your business data and generate accurate queries.

## 📊 What is Business Context?

Business context teaches the AI about:
- **Your business terminology** (what you call things)
- **Your metrics and KPIs** (how you measure success)
- **Your data relationships** (how things connect)
- **Real-world examples** (actual queries you'd ask)

---

## 1. Entities & Terminology

Define your business objects and what they mean in your organization.

### Example Format:
- **Customer**: A person or organization that makes purchases from us
- **Product**: Items available for sale in our catalog
- **Order**: A purchase transaction record
- **Subscription**: Recurring monthly service agreement
- **Fulfillment**: The process of preparing and shipping an order

### Your Entities:
(Add your business entities below)

---

## 2. Metrics & Formulas

Define how you calculate important business metrics.

### Example Format:
- **Total Revenue**: Sum of all order amounts (SUM of order_total)
- **Average Order Value (AOV)**: Total revenue ÷ number of orders
- **Customer Lifetime Value (CLV)**: Average order value × average number of orders per customer
- **Conversion Rate**: (Number of purchases ÷ Number of visitors) × 100
- **Churn Rate**: (Customers lost ÷ Total customers at start) × 100
- **Monthly Recurring Revenue (MRR)**: Sum of all active subscription amounts

### Your Metrics:
(Add your business metrics and how to calculate them)

---

## 3. Relationships & Data Structure

Explain how your data entities connect to each other.

### Example Format:
- A **Customer** can place multiple **Orders**
- Each **Order** contains one or more **Products**
- **Products** belong to **Categories**
- **Orders** have a **Fulfillment** status
- **Subscriptions** are linked to **Customers**

### Your Relationships:
(Describe your data relationships)

---

## 4. Query Examples

Provide real-world examples of questions you'd ask about your data.

### Example Format:

**Query**: "Show me revenue by month for 2025"
**Expected Result**: Table/chart with months and total revenue for each month

**Query**: "Who are my top 10 customers?"
**Expected Result**: List of customers sorted by total amount spent

**Query**: "What's my average order value this quarter?"
**Expected Result**: Single number showing AOV for current quarter

**Query**: "Compare subscription vs one-time order revenue"
**Expected Result**: Bar chart or table comparing both revenue types

### Your Query Examples:
(Add examples of questions you commonly ask about your data)

---

## 5. Business Rules & Context

Add any special business rules or context the AI should know.

### Example Format:
- Fiscal year starts in April (not January)
- "Active customer" means purchased within last 90 days
- Refunds are stored as negative order amounts
- "New customer" is first purchase ever, "returning customer" is 2+ purchases
- We operate in EST timezone
- Revenue should exclude cancelled orders (status = 'cancelled')

### Your Business Rules:
(Add your specific business rules and definitions)

---

## 💡 Tips for Better Results

1. **Be Specific**: Instead of "customer", explain what qualifies someone as a customer
2. **Include Edge Cases**: Note exceptions, special statuses, or unusual scenarios
3. **Use Examples**: Show actual values and formats (e.g., "January 2025" not "month format")
4. **Update Regularly**: Keep this document current as your business evolves
5. **Think Like You're Teaching**: Explain things as if training a new analyst

---

## 📝 Getting Started

Replace the examples above with your actual business information. The more detail you provide, the better the AI will understand your data and generate accurate queries.

Start with the most important entities and metrics, then add more detail over time.
`;

export const useBusinessContextDocument = () => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getDocument = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(FILE_NAME);

      if (error) {
        // If file doesn't exist, return default template
        if (error.message.includes('not found')) {
          setContent(DEFAULT_TEMPLATE);
          return DEFAULT_TEMPLATE;
        }
        throw error;
      }

      const text = await data.text();
      setContent(text);
      return text;
    } catch (error) {
      console.error('Error fetching business context:', error);
      toast({
        title: 'Failed to load business context',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return DEFAULT_TEMPLATE;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const saveDocument = useCallback(async (newContent: string) => {
    setIsLoading(true);
    try {
      const blob = new Blob([newContent], { type: 'text/markdown' });
      
      // Try to update first
      const { error: updateError } = await supabase.storage
        .from(BUCKET_NAME)
        .update(FILE_NAME, blob, {
          contentType: 'text/markdown',
          upsert: true,
        });

      if (updateError) {
        // If update fails, try insert
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(FILE_NAME, blob, {
            contentType: 'text/markdown',
            upsert: true,
          });

        if (uploadError) throw uploadError;
      }

      setContent(newContent);
      toast({
        title: 'Business context saved',
        description: 'Your changes have been saved successfully.',
      });
    } catch (error) {
      console.error('Error saving business context:', error);
      toast({
        title: 'Failed to save business context',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    content,
    isLoading,
    getDocument,
    saveDocument,
  };
};
