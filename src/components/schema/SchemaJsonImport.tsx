import { useState } from 'react';
import { Schema, SchemaField } from '@/types/excel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileJson, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SchemaJsonImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (schema: Schema) => void;
}

const EXAMPLE_JSON = {
  name: "sales_data",
  description: "Monthly sales performance tracking",
  fields: [
    {
      name: "invoice_number",
      displayLabel: "Invoice Number",
      type: "text",
      description: "Unique invoice identifier",
      required: true
    },
    {
      name: "status",
      displayLabel: "Status",
      type: "enum",
      enumOptions: ["Active", "Inactive", "Pending"],
      description: "Current status",
      required: true
    },
    {
      name: "sale_amount",
      displayLabel: "Sale Amount",
      type: "number",
      description: "Total sale value",
      required: true
    },
    {
      name: "sale_date",
      displayLabel: "Sale Date",
      type: "date",
      description: "Date of transaction",
      required: false
    }
  ]
};

const SchemaJsonImport = ({ open, onOpenChange, onImport }: SchemaJsonImportProps) => {
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyExample = () => {
    navigator.clipboard.writeText(JSON.stringify(EXAMPLE_JSON, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Example copied",
      description: "JSON example copied to clipboard",
    });
  };

  const validateAndImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      
      // Validate required fields
      if (!parsed.name || typeof parsed.name !== 'string') {
        throw new Error('Schema name is required and must be a string');
      }
      
      if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) {
        throw new Error('At least one field is required');
      }

      // Validate field structure
      const validTypes = ['text', 'integer', 'number', 'date', 'boolean', 'currency', 'enum'];
      const validatedFields: SchemaField[] = parsed.fields.map((field: any, index: number) => {
        if (!field.name || typeof field.name !== 'string') {
          throw new Error(`Field ${index + 1}: name is required and must be a string`);
        }
        
        if (!field.type || !validTypes.includes(field.type)) {
          throw new Error(`Field ${index + 1}: type must be one of: ${validTypes.join(', ')}`);
        }

        if (field.type === 'enum' && (!Array.isArray(field.enumOptions) || field.enumOptions.length === 0)) {
          throw new Error(`Field ${index + 1}: enum type requires enumOptions array with at least one value`);
        }

        return {
          id: `field_${Date.now()}_${index}`,
          name: field.name.trim(),
          displayLabel: field.displayLabel?.trim() || field.name.trim(),
          type: field.type,
          description: field.description?.trim() || '',
          required: !!field.required,
          enumOptions: field.type === 'enum' ? field.enumOptions : undefined,
        };
      });

      // Create schema object
      const schema: Schema = {
        id: `schema_${Date.now()}`,
        name: parsed.name.trim(),
        description: parsed.description?.trim() || '',
        fields: validatedFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      onImport(schema);
      onOpenChange(false);
      setJsonInput('');
      
      toast({
        title: "Schema imported",
        description: `"${schema.name}" has been created from JSON`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Invalid JSON format",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Import Schema from JSON
          </DialogTitle>
          <DialogDescription>
            Paste your schema definition in JSON format below
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>JSON Schema Definition</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCopyExample}
                className="text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Example
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Paste JSON here..."
              className="font-mono text-sm min-h-[200px]"
            />
          </div>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <h4 className="font-semibold text-sm">JSON Format Example:</h4>
            <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{JSON.stringify(EXAMPLE_JSON, null, 2)}
            </pre>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Required fields:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><code>name</code>: Schema name (string, e.g., "sales_data")</li>
                <li><code>fields</code>: Array of field objects (min 1 field)</li>
              </ul>
              <p className="mt-2"><strong>Field object structure:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><code>name</code>: Field name (string, required)</li>
                <li><code>type</code>: Field type (text|number|date|boolean|currency|enum, required)</li>
                <li><code>displayLabel</code>: Display label (string, optional)</li>
                <li><code>description</code>: Field description (string, optional)</li>
                <li><code>required</code>: Whether field is required (boolean, optional)</li>
                <li><code>enumOptions</code>: Array of allowed values (required for enum type)</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={validateAndImport} disabled={!jsonInput.trim()}>
            Import Schema
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SchemaJsonImport;
