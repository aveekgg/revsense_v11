import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { BusinessContext } from '@/hooks/useSupabaseBusinessContext';

interface BusinessContextFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: BusinessContext | null;
  onSave: (context: {
    name: string;
    contextType: string;
    definition: string;
    examples: string[];
  }) => void;
}

const BusinessContextForm = ({ open, onOpenChange, context, onSave }: BusinessContextFormProps) => {
  const [name, setName] = useState(context?.name || '');
  const [contextType, setContextType] = useState(context?.contextType || 'entity');
  const [definition, setDefinition] = useState(context?.definition || '');
  const [examples, setExamples] = useState<string[]>(context?.examples || ['']);

  // Reset form state when dialog opens or context changes
  useEffect(() => {
    if (open) {
      setName(context?.name || '');
      setContextType(context?.contextType || 'entity');
      setDefinition(context?.definition || '');
      setExamples(context?.examples && context.examples.length > 0 ? context.examples : ['']);
    }
  }, [open, context]);

  const handleAddExample = () => {
    setExamples([...examples, '']);
  };

  const handleUpdateExample = (index: number, value: string) => {
    const newExamples = [...examples];
    newExamples[index] = value;
    setExamples(newExamples);
  };

  const handleRemoveExample = (index: number) => {
    setExamples(examples.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const filteredExamples = examples.filter(e => e.trim() !== '');
    onSave({
      name: name.trim(),
      contextType,
      definition: definition.trim(),
      examples: filteredExamples,
    });
    onOpenChange(false);
  };

  const isValid = name.trim().length > 0 && definition.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{context ? 'Edit' : 'Create'} Business Context</DialogTitle>
          <DialogDescription>
            Define business rules and context for the AI to understand your data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g., Revenue Recognition"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Context Type</Label>
            <Select value={contextType} onValueChange={setContextType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entity">Entity - Define business objects (customers, products, orders)</SelectItem>
                <SelectItem value="formula">Formula - Define calculations (revenue, profit, averages)</SelectItem>
                <SelectItem value="relationship">Relationship - Define how entities connect</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="definition">Definition</Label>
            <Textarea
              id="definition"
              placeholder="Describe how this concept works in your business..."
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Examples</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddExample}>
                <Plus className="h-3 w-3 mr-1" />
                Add Example
              </Button>
            </div>
            {examples.map((example, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="e.g., Total revenue = Sum of all invoice amounts"
                  value={example}
                  onChange={(e) => handleUpdateExample(index, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveExample(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              Save Context
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessContextForm;
