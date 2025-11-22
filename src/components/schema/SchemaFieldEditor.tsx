import { SchemaField } from '@/types/excel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';

interface SchemaFieldEditorProps {
  field: SchemaField;
  onUpdate: (updates: Partial<SchemaField>) => void;
  onRemove: () => void;
}

const SchemaFieldEditor = ({ field, onUpdate, onRemove }: SchemaFieldEditorProps) => {
  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Field Definition</h4>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`field-name-${field.id}`}>Field Name</Label>
          <Input
            id={`field-name-${field.id}`}
            value={field.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="e.g., field1, monthly_revenue"
          />
          <p className="text-xs text-muted-foreground">Use snake_case, no spaces</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`display-label-${field.id}`}>Display Label</Label>
          <Input
            id={`display-label-${field.id}`}
            value={field.displayLabel}
            onChange={(e) => onUpdate({ displayLabel: e.target.value })}
            placeholder="e.g., Monthly Revenue"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`type-${field.id}`}>Data Type</Label>
          <Select
            value={field.type}
            onValueChange={(value: any) => onUpdate({ type: value })}
          >
            <SelectTrigger id={`type-${field.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="integer">Integer (whole numbers)</SelectItem>
              <SelectItem value="number">Number (decimals)</SelectItem>
              <SelectItem value="currency">Currency</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="enum">Enum (Categorical)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 pt-8">
          <Checkbox
            id={`required-${field.id}`}
            checked={field.required}
            onCheckedChange={(checked) => onUpdate({ required: checked as boolean })}
          />
          <Label htmlFor={`required-${field.id}`} className="font-normal">
            Required field
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`description-${field.id}`}>Description</Label>
        <Textarea
          id={`description-${field.id}`}
          value={field.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Describe what this field stores..."
          rows={2}
        />
      </div>

      {field.type === 'enum' && (
        <div className="space-y-2">
          <Label>Allowed Values</Label>
          <div className="space-y-2">
            {(field.enumOptions || []).map((option, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(field.enumOptions || [])];
                    newOptions[idx] = e.target.value;
                    onUpdate({ enumOptions: newOptions });
                  }}
                  placeholder={`Option ${idx + 1}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newOptions = (field.enumOptions || []).filter((_, i) => i !== idx);
                    onUpdate({ enumOptions: newOptions });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onUpdate({ enumOptions: [...(field.enumOptions || []), ''] });
              }}
            >
              + Add Option
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Define the allowed categorical values for this field
          </p>
        </div>
      )}

      {field.defaultValue !== undefined && (
        <div className="space-y-2">
          <Label htmlFor={`default-${field.id}`}>Default Value (Optional)</Label>
          <Input
            id={`default-${field.id}`}
            value={field.defaultValue}
            onChange={(e) => onUpdate({ defaultValue: e.target.value })}
            placeholder="Default value..."
          />
        </div>
      )}
    </div>
  );
};

export default SchemaFieldEditor;
