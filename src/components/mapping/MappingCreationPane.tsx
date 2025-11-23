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
import { useExcel } from '@/contexts/ExcelContext';

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
  const { mappingDraft, setMappingDraft } = useExcel();

  const [mappingName, setMappingName] = useState(mappingDraft.mappingName || '');
  const [description, setDescription] = useState(mappingDraft.description || '');
  const [tagsInput, setTagsInput] = useState(mappingDraft.tagsInput || '');
  const [selectedSchemaId, setSelectedSchemaId] = useState(mappingDraft.selectedSchemaId || '');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(mappingDraft.fieldMappings || []);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const selectedSchema = schemas.find(s => s.id === selectedSchemaId);
  const isEditMode = !!existingMapping;
  const isTemplateMode = !!templateMapping;
  
  // Sync local state with context draft whenever it changes (and not editing/template)
  useEffect(() => {
    if (isEditMode || isTemplateMode) return;

    setMappingDraft({
      mappingName,
      description,
      tagsInput,
      selectedSchemaId,
      fieldMappings,
    });
    setLastSaved(new Date());
  }, [mappingName, description, tagsInput, selectedSchemaId, fieldMappings, isEditMode, isTemplateMode, setMappingDraft]);

  // Initialize from context draft on mount if present (and not in edit/template mode)
  useEffect(() => {
    if (isEditMode || isTemplateMode) return;

    if (
      mappingDraft.mappingName ||
      mappingDraft.description ||
      mappingDraft.tagsInput ||
      mappingDraft.selectedSchemaId ||
      (mappingDraft.fieldMappings && mappingDraft.fieldMappings.length > 0)
    ) {
      setDraftRestored(true);
      setMappingName(mappingDraft.mappingName || '');
      setDescription(mappingDraft.description || '');
      setTagsInput(mappingDraft.tagsInput || '');
      setSelectedSchemaId(mappingDraft.selectedSchemaId || '');
      if (mappingDraft.fieldMappings && mappingDraft.fieldMappings.length > 0) {
        setFieldMappings(mappingDraft.fieldMappings);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle schema selection change
  const handleSchemaChange = (schemaId: string) => {
    setSelectedSchemaId(schemaId);
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
    if (!selectedSchema || isEditMode || isTemplateMode) return;

    // If there's a draft for this schema with any mappings, trust it and don't re-initialize
    const hasDraftForSchema =
      mappingDraft.selectedSchemaId === selectedSchema.id &&
      mappingDraft.fieldMappings &&
      mappingDraft.fieldMappings.length > 0;

    if (hasDraftForSchema) {
      // Make sure local state mirrors the draft (in case we just switched schemas back)
      setFieldMappings(mappingDraft.fieldMappings);
      setDraftRestored(true);
      console.log('📄 Using existing draft field mappings for schema:', selectedSchema.name);
      return;
    }

    // Only initialize if we don't already have any mappings locally
    if (fieldMappings.length === 0) {
      const initialMappings: FieldMapping[] = selectedSchema.fields.map(field => ({
        schemaFieldId: field.id,
        formula: '',
        cellReferences: [],
        isValid: false,
        error: undefined,
      }));
      setFieldMappings(initialMappings);
      console.log('🆕 Initialized empty field mappings for schema:', selectedSchema.name);
    }
  }, [selectedSchema, isEditMode, isTemplateMode, mappingDraft.selectedSchemaId, mappingDraft.fieldMappings, fieldMappings.length]);

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
    
    console.log('✏️  Formula updated for field:', schemaFieldId, '- Formula:', formula);
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
      
      const updatedMappings = fieldMappings.map(fm => {
        if (fm.schemaFieldId === schemaFieldId) {
          return {
            ...fm,
            computedValue: value,
            isValid: value !== null && value !== undefined,
            error: value === null ? 'Could not compute value' : undefined,
          };
        }
        return fm;
      });
      
      setFieldMappings(updatedMappings);
      
      // Context draft sync effect will pick up this change

      if (value !== null && value !== undefined) {
        toast({
          title: "Formula tested",
          description: `Result: ${value}`,
        });
      }
    } catch (error) {
      const updatedMappings = fieldMappings.map(fm => {
        if (fm.schemaFieldId === schemaFieldId) {
          return {
            ...fm,
            isValid: false,
            error: error instanceof Error ? error.message : 'Formula error',
          };
        }
        return fm;
      });
      
      setFieldMappings(updatedMappings);
      
      // Context draft sync effect will pick up this change
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
        // Clear draft in context after successful save
        if (!isEditMode && !isTemplateMode) {
          setMappingDraft({
            mappingName: '',
            description: '',
            tagsInput: '',
            selectedSchemaId: '',
            fieldMappings: [],
          });
        }
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
        // Clear draft in context after successful save
        if (!isEditMode && !isTemplateMode) {
          setMappingDraft({
            mappingName: '',
            description: '',
            tagsInput: '',
            selectedSchemaId: '',
            fieldMappings: [],
          });
        }
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
        <div className="flex items-center justify-between">
          <CardTitle>
            {isEditMode 
              ? 'Edit Mapping' 
              : isTemplateMode 
                ? 'Create from Template'
                : 'Create Mapping'
            }
          </CardTitle>
          {!isEditMode && !isTemplateMode && lastSaved && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Save className="h-3 w-3" />
              <span>Draft saved at {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
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
                <Select value={selectedSchemaId} onValueChange={handleSchemaChange}>
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
