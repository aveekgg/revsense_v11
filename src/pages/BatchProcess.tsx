import { useState } from "react";
import { Upload, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupabaseSchemas } from "@/hooks/useSupabaseSchemas";
import { useSupabaseMappings } from "@/hooks/useSupabaseMappings";
import { useBatchProcessor } from "@/hooks/useBatchProcessor";
import { FileQueue } from "@/components/batch/FileQueue";
import { BatchSummary } from "@/components/batch/BatchSummary";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BatchProcess = () => {
  const navigate = useNavigate();
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>("");
  const [selectedMappingId, setSelectedMappingId] = useState<string>("");
  
  const { schemas, isLoading: schemasLoading } = useSupabaseSchemas();
  const { mappings, isLoading: mappingsLoading } = useSupabaseMappings(selectedSchemaId);
  const { 
    files, 
    addFiles, 
    processFiles, 
    isProcessing, 
    clearFiles,
    stats 
  } = useBatchProcessor();

  const selectedSchema = schemas?.find(s => s.id === selectedSchemaId);
  const selectedMapping = mappings?.find(m => m.id === selectedMappingId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    
    const filesArray = Array.from(fileList);
    addFiles(filesArray);
    
    // Reset the input so the same files can be selected again if needed
    e.target.value = '';
  };

  const handleStartProcessing = async () => {
    if (!selectedMapping || !selectedSchema) return;
    await processFiles(selectedMapping, selectedSchema);
  };

  const canProcess = selectedMappingId && files.length > 0 && !isProcessing;
  const showSummary = stats.total > 0 && !isProcessing && files.every(f => f.status !== 'queued');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none border-b bg-background p-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/add-data')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Batch Process Excel Files</h1>
            <p className="text-sm text-muted-foreground">Upload multiple workbooks and apply a saved mapping to extract data</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle>1. Select Configuration</CardTitle>
              <CardDescription>Choose the schema and mapping to apply to all uploaded files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Target Schema</label>
                <Select
                  value={selectedSchemaId}
                  onValueChange={(value) => {
                    setSelectedSchemaId(value);
                    setSelectedMappingId("");
                  }}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a schema..." />
                  </SelectTrigger>
                  <SelectContent>
                    {schemasLoading ? (
                      <SelectItem value="loading" disabled>Loading schemas...</SelectItem>
                    ) : schemas?.length === 0 ? (
                      <SelectItem value="empty" disabled>No schemas available</SelectItem>
                    ) : (
                      schemas?.map((schema) => (
                        <SelectItem key={schema.id} value={schema.id}>
                          {schema.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Mapping</label>
                <Select
                  value={selectedMappingId}
                  onValueChange={setSelectedMappingId}
                  disabled={!selectedSchemaId || isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a mapping..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mappingsLoading ? (
                      <SelectItem value="loading" disabled>Loading mappings...</SelectItem>
                    ) : mappings?.length === 0 ? (
                      <SelectItem value="empty" disabled>No mappings for this schema</SelectItem>
                    ) : (
                      mappings?.map((mapping) => (
                        <SelectItem key={mapping.id} value={mapping.id}>
                          {mapping.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedMapping && (
                <Alert>
                  <AlertDescription className="text-sm">
                    <strong>{selectedMapping.name}</strong>
                    {selectedMapping.description && `: ${selectedMapping.description}`}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* File Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>2. Upload Excel Files</CardTitle>
              <CardDescription>Select multiple workbook files to process</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-input')?.click()}
                  disabled={!selectedMappingId || isProcessing}
                  className="relative"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Files
                </Button>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {files.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFiles}
                    disabled={isProcessing}
                  >
                    Clear All
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </span>
              </div>
            </CardContent>
          </Card>

          {/* File Queue */}
          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>3. Processing Queue</CardTitle>
                <CardDescription>
                  {isProcessing ? 'Processing files...' : 'Ready to process'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileQueue files={files} />
                
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {stats.completed} of {stats.total} completed
                    {stats.failed > 0 && (
                      <span className="text-destructive ml-2">
                        ({stats.failed} failed)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleStartProcessing}
                      disabled={!canProcess}
                    >
                      {isProcessing ? 'Processing...' : 'Start Processing'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {showSummary && (
            <BatchSummary stats={stats} files={files} />
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchProcess;
