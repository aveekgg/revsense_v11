import { useState, useEffect } from 'react';
import { useExcel } from '@/contexts/ExcelContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormulaBarProps {
  selectedRange?: string;
}

const FormulaBar = ({ selectedRange: propSelectedRange }: FormulaBarProps) => {
  const { workbookData, selectedSheet, addFieldFromFormula } = useExcel();
  const [formula, setFormula] = useState<string>('');
  const [previewValue, setPreviewValue] = useState<any>(null);

  // Update formula when external selection changes
  useEffect(() => {
    if (propSelectedRange && propSelectedRange !== formula) {
      // If formula is empty or doesn't start with =, replace it
      if (!formula || !formula.startsWith('=')) {
        setFormula(`=${propSelectedRange}`);
      } else {
        // Append to existing formula
        setFormula(prev => prev + propSelectedRange);
      }
    }
  }, [propSelectedRange]);

  useEffect(() => {
    // Reset when workbook changes
    setFormula('');
    setPreviewValue(null);
  }, [workbookData]);

  const handleAddToSchema = () => {
    if (!formula.trim()) return;
    
    addFieldFromFormula(formula);
    setFormula('');
    setPreviewValue(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && formula.trim()) {
      handleAddToSchema();
    }
  };

  if (!workbookData) return null;

  return (
    <div className="bg-card border-b border-border px-4 py-2 space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground font-medium min-w-[80px]">Selected:</span>
        <Badge variant="secondary" className={cn("text-xs", !propSelectedRange && "opacity-50")}>
          {propSelectedRange || 'Click cells to select'}
        </Badge>
        {selectedSheet && (
          <Badge variant="outline" className="text-xs">
            Sheet: {selectedSheet}
          </Badge>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium min-w-[80px]">Formula:</span>
        <Input
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="=SUM(A1:A10) or =C1+C2 or =Sheet2!A1*2"
          className="flex-1 font-mono text-sm h-8"
        />
        {previewValue !== null && (
          <Badge variant="default" className="text-xs">
            Result: {previewValue}
          </Badge>
        )}
        <Button
          size="sm"
          onClick={handleAddToSchema}
          disabled={!formula.trim()}
          className="h-8"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add to Schema
        </Button>
      </div>
    </div>
  );
};

export default FormulaBar;
