import { useState } from 'react';
import { Schema, FieldMapping } from '@/types/excel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Check, X, FileJson } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MappingJsonImportProps {
  schemas: Schema[];
  onImport: (name: string, description: string, tags: string[], schemaId: string, fieldMappings: FieldMapping[]) => void;
  onClose: () => void;
}

interface MappingJsonFormat {
  name: string;
  description?: string;
  tags?: string[];
  schemaId: string;
  schemaName?: string; // Optional, for reference
  fieldMappings: Array<{
    fieldName: string; // Field name or display label
    formula: string;
  }>;
}

const MappingJsonImport = ({ schemas, onImport, onClose }: MappingJsonImportProps) => {
  const [jsonInput, setJsonInput] = useState('');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    preview?: any;
  } | null>(null);

  const validateAndParseJson = (jsonText: string) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const data = JSON.parse(jsonText) as MappingJsonFormat;

      // Validate required fields
      if (!data.name || !data.name.trim()) {
        errors.push('Missing required field: name');
      }

      if (!data.schemaId && !data.schemaName) {
        errors.push('Must provide either schemaId or schemaName');
      }

      // Find schema
      let schema: Schema | undefined;
      if (data.schemaId) {
        schema = schemas.find(s => s.id === data.schemaId);
        if (!schema) {
          errors.push(`Schema not found with id: ${data.schemaId}`);
        }
      } else if (data.schemaName) {
        schema = schemas.find(s => s.name === data.schemaName);
        if (!schema) {
          errors.push(`Schema not found with name: ${data.schemaName}`);
        }
      }

      if (!data.fieldMappings || !Array.isArray(data.fieldMappings)) {
        errors.push('Missing or invalid fieldMappings array');
      } else if (data.fieldMappings.length === 0) {
        warnings.push('No field mappings provided');
      }

      // Validate field mappings if schema found
      const validFieldMappings: FieldMapping[] = [];
      if (schema && data.fieldMappings) {
        data.fieldMappings.forEach((fm, index) => {
          if (!fm.fieldName) {
            errors.push(`Field mapping ${index + 1}: Missing fieldName`);
            return;
          }

          if (!fm.formula) {
            warnings.push(`Field mapping ${index + 1} (${fm.fieldName}): Missing formula`);
            return;
          }

          // Find matching schema field
          const schemaField = schema.fields.find(
            f => f.name === fm.fieldName || f.displayLabel === fm.fieldName
          );

          if (!schemaField) {
            errors.push(`Field mapping ${index + 1}: Field "${fm.fieldName}" not found in schema "${schema.name}"`);
            return;
          }

          validFieldMappings.push({
            schemaFieldId: schemaField.id,
            formula: fm.formula,
            cellReferences: [],
            isValid: false, // Will be validated when applied
            error: undefined,
          });
        });
      }

      const result = {
        valid: errors.length === 0,
        errors,
        warnings,
        preview: errors.length === 0 ? {
          name: data.name,
          description: data.description || '',
          tags: data.tags || [],
          schema: schema,
          fieldMappings: validFieldMappings,
        } : undefined,
      };

      setValidationResult(result);
      return result;
    } catch (error) {
      const result = {
        valid: false,
        errors: [`JSON Parse Error: ${error instanceof Error ? error.message : 'Invalid JSON format'}`],
        warnings: [],
      };
      setValidationResult(result);
      return result;
    }
  };

  const handleValidate = () => {
    validateAndParseJson(jsonInput);
  };

  const handleImport = () => {
    const result = validateAndParseJson(jsonInput);
    
    if (result.valid && result.preview) {
      onImport(
        result.preview.name,
        result.preview.description,
        result.preview.tags,
        result.preview.schema.id,
        result.preview.fieldMappings
      );
      
      toast({
        title: "Mapping Imported",
        description: `Successfully imported "${result.preview.name}" with ${result.preview.fieldMappings.length} field mappings`,
      });
      
      onClose();
    }
  };

  const generateExampleJson = () => {
    const exampleSchema = schemas[0];
    if (!exampleSchema) {
      toast({
        title: "No schemas available",
        description: "Create a schema first to generate an example",
        variant: "destructive",
      });
      return;
    }

    const example: MappingJsonFormat = {
      name: "Example Mapping",
      description: "This is an example mapping configuration",
      tags: ["example", "template"],
      schemaId: exampleSchema.id,
      schemaName: exampleSchema.name,
      fieldMappings: exampleSchema.fields.slice(0, 3).map(field => ({
        fieldName: field.name,
        formula: "='Sheet1'!A1"
      }))
    };

    setJsonInput(JSON.stringify(example, null, 2));
    toast({
      title: "Example Generated",
      description: "Example JSON has been loaded into the editor",
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            <CardTitle>Import Mapping from JSON</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-auto">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">JSON Configuration</label>
            <Button variant="outline" size="sm" onClick={generateExampleJson}>
              <Download className="h-4 w-4 mr-2" />
              Load Example
            </Button>
          </div>
          <Textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`{
  "name": "My Mapping",
  "description": "Description here",
  "tags": ["tag1", "tag2"],
  "schemaName": "your_schema_name",
  "fieldMappings": [
    {
      "fieldName": "field1",
      "formula": "='Sheet1'!A1"
    }
  ]
}`}
            className="font-mono text-sm h-64"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleValidate} variant="outline" className="flex-1">
            Validate JSON
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!validationResult?.valid}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Mapping
          </Button>
        </div>

        {validationResult && (
          <div className="space-y-2">
            {validationResult.valid ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2 text-green-800">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">Valid JSON</span>
                </div>
                {validationResult.preview && (
                  <div className="mt-2 text-sm text-green-700">
                    <div>Name: {validationResult.preview.name}</div>
                    <div>Schema: {validationResult.preview.schema.name}</div>
                    <div>Field Mappings: {validationResult.preview.fieldMappings.length}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 text-red-800">
                  <X className="h-4 w-4" />
                  <span className="font-medium">Invalid JSON</span>
                </div>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {validationResult.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.warnings.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center gap-2 text-yellow-800">
                  <span className="font-medium">Warnings</span>
                </div>
                <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                  {validationResult.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-4 bg-muted rounded-md text-sm">
          <h4 className="font-medium mb-2">JSON Format Guide:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><code className="bg-background px-1 rounded">name</code>: Mapping name (required)</li>
            <li><code className="bg-background px-1 rounded">description</code>: Description (optional)</li>
            <li><code className="bg-background px-1 rounded">tags</code>: Array of tags (optional)</li>
            <li><code className="bg-background px-1 rounded">schemaId</code> or <code className="bg-background px-1 rounded">schemaName</code>: Target schema</li>
            <li><code className="bg-background px-1 rounded">fieldMappings</code>: Array of field mappings</li>
            <li className="ml-6"><code className="bg-background px-1 rounded">fieldName</code>: Schema field name</li>
            <li className="ml-6"><code className="bg-background px-1 rounded">formula</code>: Excel formula (e.g., ='Sheet1'!A1)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default MappingJsonImport;
