import { useState, useEffect } from 'react';
import { Schema, BulkMapping, ColumnMapping, WorkbookData } from '@/types/excel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, Upload, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BulkMappingPaneProps {
  schemas: Schema[];
  workbookData: WorkbookData | null;
  selectedSheet: string;
  onSheetChange: (sheet: string) => void;
  onBulkSave: (schemaId: string, columnMappings: ColumnMapping[], headerRow: number, startDataRow: number) => Promise<void>;
}

const BulkMappingPane = ({ schemas, workbookData, selectedSheet, onSheetChange, onBulkSave }: BulkMappingPaneProps) => {
  const [selectedSchemaId, setSelectedSchemaId] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [startDataRow, setStartDataRow] = useState(2);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const selectedSchema = schemas.find(s => s.id === selectedSchemaId);

  // Initialize column mappings when schema is selected
  useEffect(() => {
    if (selectedSchema && workbookData) {
      const initialMappings: ColumnMapping[] = selectedSchema.fields.map(field => ({
        schemaFieldId: field.id,
        excelColumn: '',
        isValid: false,
        error: undefined,
      }));
      setColumnMappings(initialMappings);
    }
  }, [selectedSchema, workbookData]);

  // Generate column options from Excel data
  const getColumnOptions = () => {
    if (!workbookData || !selectedSheet) return [];
    
    // Get the selected sheet's data to determine columns
    const sheetData = workbookData.sheets[selectedSheet];
    
    if (!sheetData || sheetData.length === 0) return [];
    
    // Generate column letters A, B, C, etc. based on the number of columns in first row
    const maxCols = Math.max(...sheetData.map(row => row.length));
    const columns = [];
    
    for (let i = 0; i < maxCols; i++) {
      const letter = String.fromCharCode(65 + i); // A=65, B=66, etc.
      const headerValue = sheetData[headerRow - 1]?.[i]; // Get header value (0-based)
      const displayText = headerValue ? `${letter} (${headerValue})` : letter;
      columns.push({ value: letter, label: displayText });
    }
    
    return columns;
  };

  const handleColumnMappingChange = (schemaFieldId: string, excelColumn: string) => {
    setColumnMappings(prev => prev.map(cm => 
      cm.schemaFieldId === schemaFieldId 
        ? { 
            ...cm, 
            excelColumn: excelColumn === '__NO_MAPPING__' ? '' : excelColumn, 
            isValid: excelColumn !== '__NO_MAPPING__' && !!excelColumn, 
            error: undefined 
          }
        : cm
    ));
  };

  const generatePreview = () => {
    if (!workbookData || !selectedSheet || !selectedSchema || columnMappings.length === 0) {
      toast({
        title: "Cannot generate preview",
        description: "Please select a schema and configure column mappings first.",
        variant: "destructive",
      });
      return;
    }

    const sheetData = workbookData.sheets[selectedSheet];
    
    if (!sheetData || sheetData.length < startDataRow) {
      toast({
        title: "No data rows found",
        description: `No data found starting from row ${startDataRow} in sheet "${selectedSheet}".`,
        variant: "destructive",
      });
      return;
    }

    const validMappings = columnMappings.filter(cm => cm.excelColumn && cm.isValid);
    if (validMappings.length === 0) {
      toast({
        title: "No valid mappings",
        description: "Please configure at least one column mapping.",
        variant: "destructive",
      });
      return;
    }

    // Generate preview data (first 5 rows)
    const preview = [];
    const maxRows = Math.min(startDataRow + 4, sheetData.length); // Show max 5 rows
    
    for (let rowIndex = startDataRow - 1; rowIndex < maxRows; rowIndex++) {
      const row = sheetData[rowIndex];
      const record: Record<string, any> = {};
      
      validMappings.forEach(mapping => {
        const field = selectedSchema.fields.find(f => f.id === mapping.schemaFieldId);
        const colIndex = mapping.excelColumn.charCodeAt(0) - 65; // A=0, B=1, etc.
        const cellValue = row?.[colIndex];
        
        if (field) {
          record[field.displayLabel] = cellValue || '';
        }
      });
      
      record._rowNumber = rowIndex + 1; // Store original row number for reference
      preview.push(record);
    }
    
    setPreviewData(preview);
    setShowPreview(true);
    
    toast({
      title: "Preview generated",
      description: `Showing first ${preview.length} rows of mapped data from "${selectedSheet}".`,
    });
  };

  const handleBulkSave = async () => {
    if (!selectedSchemaId) {
      toast({
        title: "Schema required",
        description: "Please select a schema.",
        variant: "destructive",
      });
      return;
    }

    const validMappings = columnMappings.filter(cm => cm.excelColumn && cm.isValid);
    if (validMappings.length === 0) {
      toast({
        title: "No column mappings",
        description: "Please map at least one column to a schema field.",
        variant: "destructive",
      });
      return;
    }

    try {
      await onBulkSave(selectedSchemaId, validMappings, headerRow, startDataRow);
      
      // Reset form
      setSelectedSchemaId('');
      setColumnMappings([]);
      setPreviewData([]);
      setShowPreview(false);
      
    } catch (error) {
      console.error('Bulk save error:', error);
      // Error handling is done in the parent component
    }
  };

  if (!workbookData) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Upload a workbook to start bulk mapping</p>
        </CardContent>
      </Card>
    );
  }

  const columnOptions = getColumnOptions();
  const validMappingsCount = columnMappings.filter(cm => cm.isValid).length;

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Upload Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sheet Selection */}
          {workbookData.sheetNames.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="sheet-select">Select Sheet</Label>
              <Select value={selectedSheet} onValueChange={onSheetChange}>
                <SelectTrigger id="sheet-select">
                  <SelectValue placeholder="Choose a sheet..." />
                </SelectTrigger>
                <SelectContent>
                  {workbookData.sheetNames.map(sheetName => (
                    <SelectItem key={sheetName} value={sheetName}>
                      {sheetName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Schema Selection */}
          <div className="space-y-2">
            <Label htmlFor="bulk-schema-select">Select Schema (Clean Table)</Label>
            <Select value={selectedSchemaId} onValueChange={setSelectedSchemaId}>
              <SelectTrigger id="bulk-schema-select">
                <SelectValue placeholder="Choose a schema..." />
              </SelectTrigger>
              <SelectContent>
                {schemas.map(schema => (
                  <SelectItem key={schema.id} value={schema.id}>
                    {schema.name} ({schema.fields.length} fields)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="header-row">Header Row</Label>
              <Input
                id="header-row"
                type="number"
                min="1"
                value={headerRow}
                onChange={(e) => setHeaderRow(parseInt(e.target.value) || 1)}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-data-row">First Data Row</Label>
              <Input
                id="start-data-row"
                type="number"
                min="1"
                value={startDataRow}
                onChange={(e) => setStartDataRow(parseInt(e.target.value) || 2)}
                placeholder="2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Column Mapping Card */}
      {selectedSchema && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Column Mapping</CardTitle>
              <Badge variant="outline">
                {validMappingsCount} / {selectedSchema.fields.length} mapped
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedSchema.fields.map(field => {
                const mapping = columnMappings.find(cm => cm.schemaFieldId === field.id);
                return (
                  <div key={field.id} className="grid grid-cols-2 gap-4 items-center">
                    <div>
                      <Label className="text-sm font-medium">{field.displayLabel}</Label>
                      <p className="text-xs text-muted-foreground">
                        {field.type} {field.required && '(required)'}
                      </p>
                    </div>
                    <Select
                      value={mapping?.excelColumn || '__NO_MAPPING__'}
                      onValueChange={(value) => handleColumnMappingChange(field.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NO_MAPPING__">-- No mapping --</SelectItem>
                        {columnOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview and Actions */}
      {selectedSchema && validMappingsCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview & Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={generatePreview}>
                <Eye className="mr-2 h-4 w-4" />
                Generate Preview
              </Button>
              <Button onClick={handleBulkSave} disabled={validMappingsCount === 0}>
                <Save className="mr-2 h-4 w-4" />
                Save to Clean Table
              </Button>
            </div>

            {/* Preview Table */}
            {showPreview && previewData.length > 0 && (
              <div className="space-y-2">
                <Label>Preview (first {previewData.length} rows)</Label>
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row #</TableHead>
                        {Object.keys(previewData[0]).filter(key => key !== '_rowNumber').map(key => (
                          <TableHead key={key}>{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">{row._rowNumber}</TableCell>
                          {Object.entries(row).filter(([key]) => key !== '_rowNumber').map(([key, value]) => (
                            <TableCell key={key} className="max-w-[200px] truncate">
                              {value?.toString() || ''}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkMappingPane;