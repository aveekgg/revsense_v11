import { useState, useEffect } from 'react';
import { Schema, SchemaField } from '@/types/excel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import SchemaFieldEditor from './SchemaFieldEditor';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SchemaDefinitionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema?: Schema | null;
  onSave: (schema: Schema) => void;
}

const SchemaDefinitionForm = ({ open, onOpenChange, schema, onSave }: SchemaDefinitionFormProps) => {
  const [name, setName] = useState(schema?.name || '');
  const [description, setDescription] = useState(schema?.description || '');
  const [fields, setFields] = useState<SchemaField[]>(
    schema?.fields || []
  );

  // Update form state when schema prop changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(schema?.name || '');
      setDescription(schema?.description || '');
      setFields(schema?.fields || []);
    }
  }, [schema, open]);

  const handleAddField = () => {
    const newField: SchemaField = {
      id: `field_${Date.now()}`,
      name: `field${fields.length + 1}`,
      displayLabel: `Field ${fields.length + 1}`,
      type: 'text',
      description: '',
      required: false,
    };
    setFields([...fields, newField]);
  };

  const handleUpdateField = (id: string, updates: Partial<SchemaField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const savedSchema: Schema = {
      id: schema?.id || `schema_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      fields,
      createdAt: schema?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    onSave(savedSchema);
    onOpenChange(false);
    
    // Reset form
    setName('');
    setDescription('');
    setFields([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{schema ? 'Edit Schema' : 'Create New Schema'}</DialogTitle>
          <DialogDescription>
            Define the structure of your clean data table
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="space-y-6 py-4 pr-4">
            <div className="space-y-2">
              <Label htmlFor="schema-name">Schema Name (Table Name)</Label>
              <Input
                id="schema-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., sfs, p_and_l_summary"
              />
              <p className="text-xs text-muted-foreground">
                Use lowercase, underscores for spaces
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schema-description">Description</Label>
              <Textarea
                id="schema-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this table stores..."
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Schema Fields</Label>
                <Button onClick={handleAddField} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No fields defined yet. Click "Add Field" to start.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field) => (
                    <SchemaFieldEditor
                      key={field.id}
                      field={field}
                      onUpdate={(updates) => handleUpdateField(field.id, updates)}
                      onRemove={() => handleRemoveField(field.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || fields.length === 0}>
            {schema ? 'Update Schema' : 'Create Schema'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SchemaDefinitionForm;
