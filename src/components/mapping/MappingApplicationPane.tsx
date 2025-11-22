import { useState, useEffect } from 'react';
import { SavedMapping, WorkbookData, FieldMapping, Schema } from '@/types/excel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Save, RefreshCw } from 'lucide-react';
import { computeFormula } from '@/lib/formulaComputer';
import { formatValue } from '@/lib/formatters';

interface MappingApplicationPaneProps {
  mapping: SavedMapping;
  schema: Schema | null;
  workbookData: WorkbookData;
  onSaveToCleanTable: (data: Record<string, any>) => void;
  onClose: () => void;
}

const MappingApplicationPane = ({ mapping, schema, workbookData, onSaveToCleanTable, onClose }: MappingApplicationPaneProps) => {
  const [computedMappings, setComputedMappings] = useState<FieldMapping[]>([]);
  const [isComputing, setIsComputing] = useState(true);

  useEffect(() => {
    computeAllFormulas();
  }, [mapping, workbookData]);

  const computeAllFormulas = async () => {
    setIsComputing(true);
    
    const results = await Promise.all(
      mapping.fieldMappings.map(async (fm) => {
        const field = schema?.fields.find(f => f.id === fm.schemaFieldId);
        const targetType = field?.type;
        const enumOptions = field?.enumOptions;
        
        try {
          const value = await computeFormula(fm.formula, fm.cellReferences, workbookData, targetType, enumOptions);
          return {
            ...fm,
            computedValue: value,
            isValid: value !== null && value !== undefined,
            error: value === null ? 'Could not compute value' : undefined,
          };
        } catch (error) {
          return {
            ...fm,
            isValid: false,
            error: error instanceof Error ? error.message : 'Computation error',
          };
        }
      })
    );

    setComputedMappings(results);
    setIsComputing(false);
  };

  const handleSave = () => {
    const validMappings = computedMappings.filter(cm => cm.isValid);
    
    if (validMappings.length === 0) {
      return;
    }

    // Create data object with field names as keys
    const data: Record<string, any> = {};
    validMappings.forEach(cm => {
      const field = schema?.fields.find(f => f.id === cm.schemaFieldId);
      if (field) {
        data[field.name] = cm.computedValue;
      }
    });

    onSaveToCleanTable(data);
  };

  const successCount = computedMappings.filter(cm => cm.isValid).length;
  const totalCount = computedMappings.length;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="space-y-2">
          <CardTitle>Apply Mapping: {mapping.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Target Schema: {schema?.name || 'Unknown'}</Badge>
            {mapping.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Preview Extracted Data</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Formula</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computedMappings.map(cm => {
                    const field = schema?.fields.find(f => f.id === cm.schemaFieldId);
                    if (!field) return null;

                    return (
                      <TableRow key={cm.schemaFieldId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{field.displayLabel}</div>
                            <div className="text-xs text-muted-foreground">{field.name}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{cm.formula}</TableCell>
                        <TableCell>
                          {cm.isValid ? (
                            <Badge variant="default">
                              {formatValue(cm.computedValue, field?.name, field?.type)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-destructive">{cm.error}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {cm.isValid ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <span className="text-sm font-medium">Status: </span>
                <Badge variant={successCount === totalCount ? "default" : "secondary"}>
                  {successCount}/{totalCount} fields successful
                </Badge>
              </div>
              <Button onClick={computeAllFormulas} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recompute
              </Button>
            </div>
          </div>
        </ScrollArea>

        <div className="pt-4 border-t flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            className="flex-1"
            disabled={successCount === 0}
          >
            <Save className="mr-2 h-4 w-4" />
            Save to Clean Table
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MappingApplicationPane;
