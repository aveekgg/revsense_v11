import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BusinessContextJsonImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contexts: Array<{
    name: string;
    contextType: string;
    definition: string;
    examples: string[];
  }>) => void;
}

const EXAMPLE_JSON = [
  {
    name: "Revenue Calculation",
    contextType: "formula",
    definition: "Revenue is calculated as quantity multiplied by unit price. Total revenue is the sum of all order amounts.",
    examples: [
      "What was our total revenue last month?",
      "Calculate revenue by product category"
    ]
  },
  {
    name: "Customer Entity",
    contextType: "entity",
    definition: "A customer is an individual or organization that purchases products. Customers have names, emails, and shipping addresses.",
    examples: [
      "How many unique customers do we have?",
      "List all customers from California"
    ]
  }
];

const BusinessContextJsonImport = ({ open, onOpenChange, onImport }: BusinessContextJsonImportProps) => {
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyExample = async () => {
    await navigator.clipboard.writeText(JSON.stringify(EXAMPLE_JSON, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateAndImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      
      // Validate it's an array
      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array of business contexts');
      }

      // Validate each context
      for (const context of parsed) {
        if (!context.name || typeof context.name !== 'string') {
          throw new Error('Each context must have a "name" field (string)');
        }
        if (!context.contextType || typeof context.contextType !== 'string') {
          throw new Error('Each context must have a "contextType" field (string)');
        }
        if (!['entity', 'formula', 'relationship'].includes(context.contextType)) {
          throw new Error('contextType must be one of: entity, formula, relationship');
        }
        if (!context.definition || typeof context.definition !== 'string') {
          throw new Error('Each context must have a "definition" field (string)');
        }
        if (!context.examples || !Array.isArray(context.examples)) {
          throw new Error('Each context must have an "examples" field (array)');
        }
      }

      // Import the contexts
      onImport(parsed);
      onOpenChange(false);
      setJsonInput('');
      
      toast({
        title: "Import successful",
        description: `Imported ${parsed.length} business context(s)`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : 'Invalid JSON format',
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Business Contexts from JSON</DialogTitle>
          <DialogDescription>
            Paste a JSON array of business contexts to import multiple at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="json-input">JSON Input</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyExample}
              >
                <Copy className="h-3 w-3 mr-1" />
                {copied ? 'Copied!' : 'Copy Example'}
              </Button>
            </div>
            <Textarea
              id="json-input"
              placeholder="Paste your JSON here..."
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Example Format:</Label>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
{JSON.stringify(EXAMPLE_JSON, null, 2)}
            </pre>
          </div>

          <div className="space-y-2">
            <Label>Field Requirements:</Label>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li><strong>name</strong>: String - Name of the business context</li>
              <li><strong>contextType</strong>: String - One of: "entity", "formula", "relationship"</li>
              <li><strong>definition</strong>: String - Detailed explanation of the concept</li>
              <li><strong>examples</strong>: Array of strings - Example questions or use cases</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={validateAndImport} disabled={!jsonInput.trim()}>
            Import Contexts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessContextJsonImport;
