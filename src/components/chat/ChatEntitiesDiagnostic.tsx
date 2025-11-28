import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Diagnostic component to check if chat_entities table exists
 * Add this temporarily to your AskAI page to verify setup
 */
export const ChatEntitiesDiagnostic = () => {
  useEffect(() => {
    const checkSetup = async () => {
      console.log('🔧 Running Chat Entities Diagnostic...');
      
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('❌ Authentication issue:', authError);
        return;
      }
      console.log('✅ User authenticated:', user.id);
      
      // Try to query the table
      const { data, error } = await supabase
        .from('chat_entities')
        .select('*')
        .limit(5);
      
      if (error) {
        console.error('❌ Table query error - TABLE MAY NOT EXIST:', error);
        console.log('💡 You need to apply the migration! See CHAT_ENTITIES_QUICK_START.md');
        return;
      }
      
      console.log('✅ Table exists! Found', data?.length || 0, 'entities');
      console.log('📊 Entities:', data);
      
      if (data && data.length === 0) {
        console.log('💡 Table is empty. Add entities via Project Config → Chat Entities tab');
      }
    };
    
    checkSetup();
  }, []);
  
  return null; // This component doesn't render anything
};
