import { useRef, useState } from 'react';
import { useExcel } from '@/contexts/ExcelContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Copy, Zap, Grid } from "lucide-react";
import ExcelViewer from '@/components/excel/ExcelViewer';
import MappingCreationPane from '@/components/mapping/MappingCreationPane';
import MappingApplicationPane from '@/components/mapping/MappingApplicationPane';
import BulkMappingPane from '@/components/mapping/BulkMappingPane';
import { toast } from '@/hooks/use-toast';

const AddData = () => {
  const { 
    uploadWorkbook, 
    isUploading, 
    workbookData, 
    recentUploads, 
    loadRecentUpload, 
    schemas, 
    savedMappings, 
    saveMappingNew, 
    updateMappingById,
    saveDataToCleanTable,
    saveBulkDataToCleanTable,
    getSchema,
    loadMappingForEdit,
    clearLoadedMapping,
    loadedMappingForEdit,
    clearWorkbook,
    selectedSheet,
    setSelectedSheet
  } = useExcel();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedMappingId, setSelectedMappingId] = useState('');
  const [templateMapping, setTemplateMapping] = useState<typeof savedMappings[0] | null>(null);
  const [activeTab, setActiveTab] = useState<'advanced' | 'bulk'>('advanced');

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadWorkbook(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedMappingId('');
    }
  };

  const handleLoadAsTemplate = () => {
    if (!selectedMappingId) return;
    
    const mapping = savedMappings.find(m => m.id === selectedMappingId);
    if (mapping) {
      setTemplateMapping(mapping);
      setSelectedMappingId('');
      toast({
        title: "Template Loaded",
        description: `You can now edit "${mapping.name}" and save it as a new mapping.`,
      });
    }
  };

  const selectedMapping = savedMappings.find(m => m.id === selectedMappingId);
  const mappingSchema = selectedMapping ? getSchema(selectedMapping.schemaId) : null;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 animate-fade-in">
          {!workbookData ? (
            <>
              <div>
                <h2 className="text-2xl font-bold">Upload Excel Workbook</h2>
                <p className="text-muted-foreground">
                  Upload your Excel file to start mapping data to your global schema
                </p>
              </div>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Upload Excel File</CardTitle>
                      <CardDescription>.xlsx or .xls files</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isUploading ? 'Uploading...' : 'Choose File'}
                  </Button>
                  {isUploading && (
                    <div className="space-y-2">
                      <Progress value={66} className="w-full" />
                      <p className="text-sm text-muted-foreground text-center">
                        Parsing workbook...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 flex-1 relative z-50">
                  <Select value={selectedMappingId} onValueChange={setSelectedMappingId}>
                    <SelectTrigger className="w-[300px] relative z-50">
                      <SelectValue placeholder="Apply existing mapping..." />
                    </SelectTrigger>
                    <SelectContent className="relative z-50">
                      {savedMappings.filter(m => m.schemaId).map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    onClick={handleLoadAsTemplate}
                    disabled={!selectedMappingId}
                    title="Load as template to create a new mapping"
                    className="relative z-40"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    clearWorkbook();
                    setSelectedMappingId('');
                    setTemplateMapping(null);
                  }}
                  className="relative z-40"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Clear & Upload New
                </Button>
              </div>
              <div className="relative z-10">
                <ExcelViewer />
              </div>
            </>
          )}

          {recentUploads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Uploads</CardTitle>
                <CardDescription>Your recently uploaded workbooks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentUploads.map((upload) => (
                    <div
                      key={upload.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{upload.fileName}</p>
                          <p className="text-sm text-muted-foreground">
                            {upload.fileSize} • {upload.uploadDate}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => loadRecentUpload(upload)}>
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {workbookData && (
        <div className="w-[400px] border-l bg-card overflow-auto">
          <div className="p-4">
            {selectedMapping ? (
              <MappingApplicationPane
                mapping={selectedMapping}
                schema={mappingSchema}
                workbookData={workbookData}
                onSaveToCleanTable={async (data) => {
                  try {
                    await saveDataToCleanTable(selectedMapping.schemaId, data, workbookData.fileName, selectedMapping.id);
                    toast({
                      title: "Success",
                      description: "Data saved to clean table successfully",
                    });
                    setSelectedMappingId('');
                  } catch (error) {
                    console.error('Error saving to clean table:', error);
                    toast({
                      title: "Error saving data",
                      description: error instanceof Error ? error.message : 'Unknown error occurred',
                      variant: "destructive",
                    });
                  }
                }}
                onClose={() => setSelectedMappingId('')}
              />
            ) : (
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'advanced' | 'bulk')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="advanced" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className="hidden sm:inline">Advanced Mapping</span>
                    <span className="sm:hidden">Advanced</span>
                  </TabsTrigger>
                  <TabsTrigger value="bulk" className="flex items-center gap-2">
                    <Grid className="h-4 w-4" />
                    <span className="hidden sm:inline">Bulk Upload</span>
                    <span className="sm:hidden">Bulk</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="advanced" className="mt-4">
                  <MappingCreationPane
                    schemas={schemas}
                    workbookData={workbookData}
                    existingMapping={loadedMappingForEdit}
                    templateMapping={templateMapping}
                    onSave={async (name, desc, tags, schemaId, mappings) => {
                      await saveMappingNew(name, desc, tags, schemaId, mappings);
                      setTemplateMapping(null);
                    }}
                    onUpdate={async (id, name, desc, tags, schemaId, mappings) => {
                      await updateMappingById(id, name, desc, tags, schemaId, mappings);
                    }}
                    onCancel={() => {
                      clearLoadedMapping();
                      setTemplateMapping(null);
                    }}
                  />
                </TabsContent>
                
                <TabsContent value="bulk" className="mt-4">
                  <BulkMappingPane
                    schemas={schemas}
                    workbookData={workbookData}
                    selectedSheet={selectedSheet}
                    onSheetChange={setSelectedSheet}
                    onBulkSave={async (schemaId, columnMappings, headerRow, startDataRow) => {
                      try {
                        if (!workbookData) {
                          throw new Error('No workbook data available');
                        }

                        const successCount = await saveBulkDataToCleanTable(
                          schemaId,
                          columnMappings,
                          workbookData,
                          selectedSheet,
                          headerRow,
                          startDataRow
                        );

                        toast({
                          title: "Bulk upload completed",
                          description: `Successfully saved ${successCount} records to clean table from sheet "${selectedSheet}"`,
                        });

                      } catch (error) {
                        console.error('Bulk save error:', error);
                        toast({
                          title: "Bulk upload failed",
                          description: error instanceof Error ? error.message : 'Unknown error occurred',
                          variant: "destructive",
                        });
                      }
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddData;
