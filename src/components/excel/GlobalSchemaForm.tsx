import { useState } from 'react';
import { useExcel } from '@/contexts/ExcelContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, MousePointerClick, Save, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatValue } from '@/lib/formatters';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const GlobalSchemaForm = () => {
  const {
    schemaFields,
    selectionMode,
    savedMappings,
    addSchemaField,
    removeSchemaField,
    updateField,
    startCellSelection,
    computeFieldValue,
    computeAllFields,
    saveMapping,
    loadMapping,
    workbookData,
  } = useExcel();

  const [mappingName, setMappingName] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  const handleSaveMapping = () => {
    if (mappingName.trim()) {
      saveMapping(mappingName);
      setMappingName('');
      setSaveDialogOpen(false);
    }
  };

  const handleLoadMapping = (id: string) => {
    loadMapping(id);
    setLoadDialogOpen(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with title and actions */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Global Schema</h3>
          <div className="flex gap-2">
          <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderOpen className="h-4 w-4 mr-1" />
                Load
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Load Saved Mapping</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {savedMappings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No saved mappings</p>
                  ) : (
                    savedMappings.map(mapping => (
                      <Card key={mapping.id} className="cursor-pointer hover:bg-accent" onClick={() => handleLoadMapping(mapping.id)}>
                        <CardContent className="p-3">
                          <div className="font-medium">{mapping.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {mapping.fields?.length || mapping.fieldMappings?.length || 0} fields • {new Date(mapping.createdAt).toLocaleDateString()}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Mapping</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Mapping Name</Label>
                  <Input
                    value={mappingName}
                    onChange={(e) => setMappingName(e.target.value)}
                    placeholder="Enter mapping name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveMapping}>Save Mapping</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </div>

      {/* Scrollable fields list */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 py-4">
          {schemaFields.map((field) => (
            <Card key={field.id} className="p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={field.name}
                    onChange={(e) => updateField(field.id, { name: e.target.value })}
                    placeholder="Field name"
                    className="flex-1 font-medium"
                  />
                  <Select
                    value={field.type}
                    onValueChange={(value: any) => updateField(field.id, { type: value })}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSchemaField(field.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div>
                  <Input
                    value={field.formula}
                    onChange={(e) => {
                      updateField(field.id, { formula: e.target.value });
                      computeFieldValue(field.id);
                    }}
                    placeholder="=A1+B2 or =SUM(A1:A10) or =Sheet2!C5"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <span className="text-xs text-muted-foreground">Value:</span>
                  <span className="font-semibold text-sm">
                    {formatValue(field.computedValue, field.name, field.type)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Fixed bottom actions */}
      <div className="flex-shrink-0 p-4 border-t space-y-2">
        <Button onClick={addSchemaField} variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
        <Button
          onClick={computeAllFields}
          className="w-full"
          disabled={!workbookData || schemaFields.length === 0}
        >
          Apply Mapping
        </Button>
      </div>
    </div>
  );
};

export default GlobalSchemaForm;
