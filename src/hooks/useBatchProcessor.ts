import { useState } from "react";
import { SavedMapping, Schema, WorkbookData } from "@/types/excel";
import { parseExcelFile } from "@/lib/excelParser";
import { computeFormula } from "@/lib/formulaComputer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BatchFile {
  id: string;
  file: File;
  status: 'queued' | 'processing' | 'completed' | 'error';
  extractedFields?: number;
  error?: string;
}

interface BatchStats {
  total: number;
  completed: number;
  failed: number;
  totalRecordsCreated: number;
}

export const useBatchProcessor = () => {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<BatchStats>({
    total: 0,
    completed: 0,
    failed: 0,
    totalRecordsCreated: 0,
  });

  const addFiles = (newFiles: File[]) => {
    const batchFiles: BatchFile[] = newFiles.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: 'queued' as const,
    }));
    setFiles(prev => [...prev, ...batchFiles]);
    setStats(prev => ({ ...prev, total: prev.total + newFiles.length }));
  };

  const clearFiles = () => {
    setFiles([]);
    setStats({
      total: 0,
      completed: 0,
      failed: 0,
      totalRecordsCreated: 0,
    });
  };

  const updateFileStatus = (
    fileId: string,
    update: Partial<BatchFile>
  ) => {
    setFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, ...update } : f))
    );
  };

  const processFiles = async (mapping: SavedMapping, schema: Schema) => {
    setIsProcessing(true);
    let completedCount = 0;
    let failedCount = 0;
    let recordsCreated = 0;

    for (const batchFile of files) {
      if (batchFile.status !== 'queued') continue;

      try {
        // Update status to processing
        updateFileStatus(batchFile.id, { status: 'processing' });

        // 1. Parse Excel file (in memory only)
        console.log(`Processing file: ${batchFile.file.name}`);
        const workbookData = await parseExcelFile(batchFile.file);

        // 2. Compute formulas for all field mappings
        const computedData: Record<string, any> = {};
        let validFields = 0;

        for (const fieldMapping of mapping.fieldMappings) {
          const schemaField = schema.fields.find(
            f => f.id === fieldMapping.schemaFieldId
          );
          
          if (!schemaField) continue;

          try {
            const value = await computeFormula(
              fieldMapping.formula,
              fieldMapping.cellReferences,
              workbookData,
              schemaField.type,
              schemaField.enumOptions
            );
            
            computedData[schemaField.name] = value;
            validFields++;
          } catch (error) {
            console.error(
              `Error computing field ${schemaField.name}:`,
              error
            );
            // Skip this field but continue with others
          }
        }

        if (validFields === 0) {
          throw new Error('No valid fields could be computed');
        }

        // 3. Save to schema-specific clean table via edge function
        const tableName = `clean_${schema.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
        
        const { data, error } = await supabase.functions.invoke('insert-clean-data', {
          body: {
            tableName,
            data: computedData,
            sourceWorkbook: batchFile.file.name,
            sourceMappingId: mapping.id,
          },
        });

        // Check for both network errors and edge function errors
        if (error) {
          throw new Error(error.message || 'Failed to insert data');
        }
        
        if (data?.error) {
          throw new Error(data.error);
        }
        
        if (!data?.success) {
          throw new Error('Insert failed without error message');
        }

        // 4. Update status to completed
        updateFileStatus(batchFile.id, {
          status: 'completed',
          extractedFields: validFields,
        });
        
        completedCount++;
        recordsCreated++;
        
      } catch (error) {
        console.error(`Error processing ${batchFile.file.name}:`, error);
        
        // Update status to error
        updateFileStatus(batchFile.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        failedCount++;
      }
    }

    // Update final stats
    setStats(prev => ({
      ...prev,
      completed: prev.completed + completedCount,
      failed: prev.failed + failedCount,
      totalRecordsCreated: prev.totalRecordsCreated + recordsCreated,
    }));

    setIsProcessing(false);

    // Show summary toast
    if (failedCount === 0) {
      toast.success(`Successfully processed ${completedCount} file${completedCount !== 1 ? 's' : ''}`);
    } else {
      toast.warning(
        `Completed: ${completedCount}, Failed: ${failedCount}`,
        {
          description: 'Check the queue for error details',
        }
      );
    }
  };

  return {
    files,
    addFiles,
    processFiles,
    isProcessing,
    clearFiles,
    stats,
  };
};
