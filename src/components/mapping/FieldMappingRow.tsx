import { SchemaField, FieldMapping, WorkbookData } from '@/types/excel';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Play, Database } from 'lucide-react';
import { formatValue } from '@/lib/formulaComputer';

interface FieldMappingRowProps {
  field: SchemaField;
  mapping?: FieldMapping;
  workbookData: WorkbookData;
  onUpdateFormula: (formula: string) => void;
  onTest: () => void;
}

const FieldMappingRow = ({ field, mapping, workbookData, onUpdateFormula, onTest }: FieldMappingRowProps) => {
  return (
    <div className="border rounded-lg p-4 space-y-3 transition-all">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{field.displayLabel}</span>
            <Badge variant="outline" className="text-xs">{field.type}</Badge>
            {field.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
        </div>
        
        {mapping?.isValid && (
          <CheckCircle className="h-5 w-5 text-green-500" />
        )}
        {mapping?.error && (
          <AlertCircle className="h-5 w-5 text-destructive" />
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
        <Textarea
          value={mapping?.formula || ''}
          onChange={(e) => onUpdateFormula(e.target.value)}
          placeholder={`Examples:
Math: =Sheet1!A1+Sheet2!B2 or =SUM(A1:A10) or =Sheet1!B5/100
AI: =AI("extract company name", A5)
Combined AI+Math: =AI("extract days", B12)/30
Combined Cell+Constant: =(Sheet1!A1-1000)*2
Constant: "USA" or 100 or true`}
          className="font-mono text-sm min-h-[80px] resize-y"
          rows={3}
        />
        </div>
        <Button onClick={onTest} size="sm" variant="outline" title="Test formula" className="self-start">
          <Play className="h-3 w-3" />
        </Button>
      </div>

      {/* Show allowed values for enum fields */}
      {field.type === 'enum' && field.enumOptions && field.enumOptions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Allowed values:</span>
          {field.enumOptions.map((option, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {option}
            </Badge>
          ))}
        </div>
      )}

      {/* Show parsed cell references for confirmation */}
      {mapping?.cellReferences && mapping.cellReferences.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Database className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Stored references:</span>
          {mapping.cellReferences.map((ref, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs font-mono">
              {ref.sheet}!{ref.cell}
            </Badge>
          ))}
        </div>
      )}

      {mapping?.computedValue !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <Badge variant="default">
            {formatValue(mapping.computedValue, field.type)}
          </Badge>
        </div>
      )}

      {mapping?.error && (
        <div className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {mapping.error}
        </div>
      )}

      {mapping?.formula && mapping.formula.includes('AI(') && (
        <Badge variant="secondary" className="text-xs">
          🤖 AI Function
        </Badge>
      )}
    </div>
  );
};

export default FieldMappingRow;
