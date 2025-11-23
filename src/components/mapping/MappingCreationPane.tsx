import { useState, useEffect, useCallback } from 'react';
import { Schema, FieldMapping, WorkbookData, SavedMapping } from '@/types/excel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, AlertCircle } from 'lucide-react';
import FieldMappingRow from './FieldMappingRow';
import { computeFormula, parseExcelFormula } from '@/lib/formulaComputer';
import { toast } from '@/hooks/use-toast';

interface MappingCreationPaneProps {
  schemas: Schema[];
  workbookData: WorkbookData | null;
  existingMapping?: SavedMapping | null;
  templateMapping?: SavedMapping | null;
  onSave: (name: string, description: string, tags: string[], schemaId: string, fieldMappings: FieldMapping[]) => void;
  onUpdate?: (id: string, name: string, description: string, tags: string[], schemaId: string, fieldMappings: FieldMapping[]) => void;
  onCancel?: () => void;
}

const MappingCreationPane = ({ schemas, workbookData, existingMapping, templateMapping, onSave, onUpdate, onCancel }: MappingCreationPaneProps) => {
  const [mappingName, setMappingName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedSchemaId, setSelectedSchemaId] = useState('');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

  const selectedSchema = schemas.find(s => s.id === selectedSchemaId);
  const isEditMode = !!existingMapping;
  const isTemplateMode = !!templateMapping;
  
  // Storage key for draft state
  const DRAFT_STORAGE_KEY = 'mapping-creation-draft';
  
  // Helper function to save draft
  const saveDraft = useCallback(() => {
    // Don't save draft if editing existing mapping or using template
    if (isEditMode || isTemplateMode) return;
    
    const draft = {
      mappingName,
      description,
      tagsInput,
      selectedSchemaId,
      fieldMappings,
      timestamp: Date.now(),
    };
    
    // Only save if there's actual content
    if (mappingName || description || selectedSchemaId || fieldMappings.some(fm => fm.formula)) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [mappingName, description, tagsInput, selectedSchemaId, fieldMappings, isEditMode, isTemplateMode]);
  
  // Save draft to localStorage whenever state changes
  useEffect(() => {
    saveDraft();
  }, [saveDraft]);
  
  // Save draft before tab/window closes or switches
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveDraft();
    };
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveDraft();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveDraft]);
  
  // Restore draft on component mount
  useEffect(() => {
    // Only restore if not editing and not template mode
    if (isEditMode || isTemplateMode) return;
    
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        // Only restore if draft is less than 24 hours old
        const age = Date.now() - draft.timestamp;
        if (age < 24 * 60 * 60 * 1000) {
          setMappingName(draft.mappingName || '');
          setDescription(draft.description || '');
          setTagsInput(draft.tagsInput || '');
          setSelectedSchemaId(draft.selectedSchemaId || '');
          setFieldMappings(draft.fieldMappings || []);
          
          toast({
            title: "Draft Restored",
            description: "Your previous mapping work has been restored.",
          });
        }
      } catch (error) {
        console.error('Failed to restore draft:', error);
      }
    }
  }, []); // Run only once on mount
  
  // Clear draft when successfully saved
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  // Load existing mapping data for editing
  useEffect(() => {
    if (existingMapping) {
      setMappingName(existingMapping.name);
      setDescription(existingMapping.description || '');
      setTagsInput(existingMapping.tags.join(', '));
      setSelectedSchemaId(existingMapping.schemaId);
      
      // Get the schema for this mapping
      const schema = schemas.find(s => s.id === existingMapping.schemaId);
      if (schema) {
        // Create a Set of existing field IDs in the mapping
        const existingFieldIds = new Set(
          existingMapping.fieldMappings.map(fm => fm.schemaFieldId)
        );
        
        // Find fields in the schema that don't have mappings
        const missingFieldMappings = schema.fields
          .filter(field => !existingFieldIds.has(field.id))
          .map(field => ({
            schemaFieldId: field.id,
            formula: '',
            cellReferences: [],
            isValid: false,
            error: undefined,
          }));
        
        // Merge existing mappings with new empty mappings for added fields
        setFieldMappings([...existingMapping.fieldMappings, ...missingFieldMappings]);
      } else {
        // Fallback if schema not found
        setFieldMappings(existingMapping.fieldMappings);
      }
    }
  }, [existingMapping, schemas]);

  // Load template mapping data for cloning
  useEffect(() => {
    if (templateMapping) {
      setMappingName(templateMapping.name + ' (Copy)');
      setDescription(templateMapping.description || '');
      setTagsInput(templateMapping.tags.join(', '));
      setSelectedSchemaId(templateMapping.schemaId);
      
      // Get the schema for this template
      const schema = schemas.find(s => s.id === templateMapping.schemaId);
      if (schema) {
        // Create a Set of existing field IDs in the template
        const existingFieldIds = new Set(
          templateMapping.fieldMappings.map(fm => fm.schemaFieldId)
        );
        
        // Find fields in the schema that don't have mappings
        const missingFieldMappings = schema.fields
          .filter(field => !existingFieldIds.has(field.id))
          .map(field => ({
            schemaFieldId: field.id,
            formula: '',
            cellReferences: [],
            isValid: false,
            error: undefined,
          }));
        
        // Merge template mappings with new empty mappings for added fields
        setFieldMappings([...templateMapping.fieldMappings, ...missingFieldMappings]);
      } else {
        // Fallback if schema not found
        setFieldMappings(templateMapping.fieldMappings);
      }
    }
  }, [templateMapping, schemas]);

  useEffect(() => {
    if (selectedSchema && !isEditMode && !isTemplateMode) {
      // Initialize field mappings for all schema fields (only when creating new from scratch)
      const initialMappings: FieldMapping[] = selectedSchema.fields.map(field => ({
        schemaFieldId: field.id,
        formula: '',
        cellReferences: [],
        isValid: false,
        error: undefined,
      }));
      setFieldMappings(initialMappings);
    }
  }, [selectedSchema, isEditMode, isTemplateMode]);

  const handleUpdateFieldMapping = (schemaFieldId: string, formula: string) => {
    if (!workbookData) return;

    const { cellRefs } = parseExcelFormula(formula, workbookData.sheetNames[0], workbookData.sheetNames);
    
    setFieldMappings(prev => prev.map(fm => {
      if (fm.schemaFieldId === schemaFieldId) {
        return {
          ...fm,
          formula,
          cellReferences: cellRefs,
        };
      }
      return fm;
    }));
  };

  const handleTestFormula = async (schemaFieldId: string) => {
    if (!workbookData) return;

    const mapping = fieldMappings.find(fm => fm.schemaFieldId === schemaFieldId);
    if (!mapping || !mapping.formula) return;

    const field = selectedSchema?.fields.find(f => f.id === schemaFieldId);
    const targetType = field?.type;
    const enumOptions = field?.enumOptions;

    try {
      // Show loading toast for AI functions
      const isAIFunction = mapping.formula.includes('AI(');
      if (isAIFunction) {
        toast({
          title: "Testing AI Function",
          description: "Calling OpenAI API...",
        });
      }

      const value = await computeFormula(mapping.formula, mapping.cellReferences, workbookData, targetType, enumOptions);
      
      setFieldMappings(prev => prev.map(fm => {
        if (fm.schemaFieldId === schemaFieldId) {
          return {
            ...fm,
            computedValue: value,
            isValid: value !== null && value !== undefined,
            error: value === null ? 'Could not compute value' : undefined,
          };
        }
        return fm;
      }));

      if (value !== null && value !== undefined) {
        toast({
          title: "Formula tested",
          description: `Result: ${value}`,
        });
      }
    } catch (error) {
      setFieldMappings(prev => prev.map(fm => {
        if (fm.schemaFieldId === schemaFieldId) {
          return {
            ...fm,
            isValid: false,
            error: error instanceof Error ? error.message : 'Formula error',
          };
        }
        return fm;
      }));
    }
  };

  const validateAllFormulas = async (): Promise<FieldMapping[]> => {
    if (!workbookData || !selectedSchema) return fieldMappings;

    const mappingsToValidate = fieldMappings.filter(
      fm => fm.formula && !fm.isValid
    );

    if (mappingsToValidate.length === 0) {
      return fieldMappings;
    }

    const updatedMappings = [...fieldMappings];

    for (const mapping of mappingsToValidate) {
      const field = selectedSchema.fields.find(f => f.id === mapping.schemaFieldId);
      const targetType = field?.type;
      const enumOptions = field?.enumOptions;

      try {
        const value = await computeFormula(
          mapping.formula,
          mapping.cellReferences,
          workbookData,
          targetType,
          enumOptions
        );

        const index = updatedMappings.findIndex(fm => fm.schemaFieldId === mapping.schemaFieldId);
        if (index !== -1) {
          updatedMappings[index] = {
            ...updatedMappings[index],
            computedValue: value,
            isValid: value !== null && value !== undefined,
            error: value === null ? 'Could not compute value' : undefined,
          };
        }
      } catch (error) {
        const index = updatedMappings.findIndex(fm => fm.schemaFieldId === mapping.schemaFieldId);
        if (index !== -1) {
          updatedMappings[index] = {
            ...updatedMappings[index],
            isValid: false,
            error: error instanceof Error ? error.message : 'Formula error',
          };
        }
      }
    }

    return updatedMappings;
  };

  const handleSave = async () => {
    if (!mappingName.trim()) {
      toast({
        title: "Mapping name required",
        description: "Please enter a name for this mapping.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSchemaId) {
      toast({
        title: "Schema required",
        description: "Please select a schema.",
        variant: "destructive",
      });
      return;
    }

    const mappingsWithFormulas = fieldMappings.filter(fm => fm.formula);
    if (mappingsWithFormulas.length === 0) {
      toast({
        title: "No field mappings",
        description: "Please add at least one field mapping with a formula.",
        variant: "destructive",
      });
      return;
    }

    // Auto-validate all formulas that haven't been validated yet
    const untested = fieldMappings.filter(fm => fm.formula && !fm.isValid);
    if (untested.length > 0) {
      toast({
        title: "Validating field mappings",
        description: `Testing ${untested.length} field${untested.length > 1 ? 's' : ''}...`,
      });

      const validatedMappings = await validateAllFormulas();
      setFieldMappings(validatedMappings);

      // Filter valid mappings from the newly validated set
      const validMappings = validatedMappings.filter(fm => fm.formula && fm.isValid);
      const failedMappings = validatedMappings.filter(fm => fm.formula && !fm.isValid);

      if (validMappings.length === 0) {
        toast({
          title: "Validation failed",
          description: "None of the field mappings could be validated. Please check your formulas.",
          variant: "destructive",
        });
        return;
      }

      if (failedMappings.length > 0) {
        const failedFields = failedMappings
          .map(fm => selectedSchema?.fields.find(f => f.id === fm.schemaFieldId)?.displayLabel)
          .filter(Boolean)
          .join(', ');
        
        toast({
          title: `Saving ${validMappings.length} of ${mappingsWithFormulas.length} fields`,
          description: `Failed to validate: ${failedFields}`,
        });
      } else {
        toast({
          title: "All fields validated",
          description: `Successfully validated ${validMappings.length} field${validMappings.length > 1 ? 's' : ''}`,
        });
      }

      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      
      if (isEditMode && onUpdate && existingMapping) {
        onUpdate(existingMapping.id, mappingName, description, tags, selectedSchemaId, validMappings);
      } else {
        // Template mode and create mode both save as new
        onSave(mappingName, description, tags, selectedSchemaId, validMappings);
        clearDraft(); // Clear draft after successful save
      }
    } else {
      // All formulas already validated
      const validMappings = fieldMappings.filter(fm => fm.formula && fm.isValid);
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      
      if (isEditMode && onUpdate && existingMapping) {
        onUpdate(existingMapping.id, mappingName, description, tags, selectedSchemaId, validMappings);
      } else {
        // Template mode and create mode both save as new
        onSave(mappingName, description, tags, selectedSchemaId, validMappings);
        clearDraft(); // Clear draft after successful save
      }
    }
    
    toast({
      title: "Mapping saved",
      description: `Saved mapping successfully`,
    });

    // Reset form only if not in edit mode
    if (!isEditMode) {
      setMappingName('');
      setDescription('');
      setTagsInput('');
      setSelectedSchemaId('');
      setFieldMappings([]);
    }
  };

  if (!workbookData) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Upload a workbook to create mappings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>
          {isEditMode 
            ? 'Edit Mapping' 
            : isTemplateMode 
              ? 'Create from Template'
              : 'Create Mapping'
          }
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Mapping Header */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mapping-name">Mapping Name</Label>
                <Input
                  id="mapping-name"
                  value={mappingName}
                  onChange={(e) => setMappingName(e.target.value)}
                  placeholder="e.g., January P&L Mapping"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mapping-description">Description</Label>
                <Textarea
                  id="mapping-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this mapping..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mapping-tags">Tags (comma-separated)</Label>
                <Input
                  id="mapping-tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g., quarterly, p&l, 2024"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="schema-select">Select Schema (Clean Table)</Label>
                <Select value={selectedSchemaId} onValueChange={setSelectedSchemaId}>
                  <SelectTrigger id="schema-select">
                    <SelectValue placeholder="Choose a schema..." />
                  </SelectTrigger>
                  <SelectContent>
                    {schemas.map(schema => (
                      <SelectItem key={schema.id} value={schema.id}>
                        {schema.name} ({schema.fields.length} fields)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Field Mappings */}
            {selectedSchema && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Field Mappings</Label>
                  <Badge variant="outline">
                    {fieldMappings.filter(fm => fm.isValid).length} / {selectedSchema.fields.length} mapped
                  </Badge>
                </div>

                <div className="space-y-3">
                  {selectedSchema.fields.map(field => {
                    const mapping = fieldMappings.find(fm => fm.schemaFieldId === field.id);
                    return (
                      <FieldMappingRow
                        key={field.id}
                        field={field}
                        mapping={mapping}
                        workbookData={workbookData}
                        onUpdateFormula={(formula) => handleUpdateFieldMapping(field.id, formula)}
                        onTest={() => handleTestFormula(field.id)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t space-y-2">
          {isEditMode && onCancel && (
            <Button 
              onClick={onCancel} 
              variant="outline"
              className="w-full"
            >
              Cancel Edit
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            className="w-full"
            disabled={!selectedSchemaId || !mappingName.trim()}
          >
            <Save className="mr-2 h-4 w-4" />
            {isEditMode ? 'Update Mapping' : 'Save as New Mapping'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MappingCreationPane;
