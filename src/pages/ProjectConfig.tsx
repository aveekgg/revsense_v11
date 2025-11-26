import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SecondaryTabs from "@/components/layout/SecondaryTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileSpreadsheet, Trash2, Database, Eye } from "lucide-react";
import { useExcel } from "@/contexts/ExcelContext";
import { Badge } from "@/components/ui/badge";
import SchemaDefinitionForm from "@/components/schema/SchemaDefinitionForm";
import SchemaList from "@/components/schema/SchemaList";
import SchemaJsonImport from "@/components/schema/SchemaJsonImport";
import { SchemaDeleteDialog } from '@/components/schema/SchemaDeleteDialog';
import BusinessContextEditor from "@/components/business/BusinessContextEditor";
import MappingDetailsSheet from "@/components/mapping/MappingDetailsSheet";
import { ChatEntitiesManager } from "@/components/chat/ChatEntitiesManager";
import { Schema, SavedMapping } from "@/types/excel";

const ProjectConfig = () => {
  const navigate = useNavigate();
  const { 
    loadMapping, 
    savedMappings, 
    schemas, 
    createSchema, 
    updateSchemaById, 
    deleteSchemaById, 
    refreshSchemas, 
    getMappingsForSchema, 
    isSchemasLoading, 
    isMappingsLoading,
    updateMappingById,
    refreshMappings
  } = useExcel();
  const [activeTab, setActiveTab] = useState("Schemas");
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const [editingSchema, setEditingSchema] = useState<Schema | null>(null);
  const [schemaToDelete, setSchemaToDelete] = useState<Schema | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingMapping, setViewingMapping] = useState<SavedMapping | null>(null);
  const [mappingDetailsOpen, setMappingDetailsOpen] = useState(false);
  const tabs = ["Schemas", "Mappings", "Business Logic", "Chat Entities"];

  useEffect(() => {
    refreshSchemas();
  }, [activeTab, refreshSchemas]);

  const handleCreateNewMapping = () => {
    navigate('/dashboard/add-data');
  };

  const handleLoadMapping = (id: string) => {
    loadMapping(id);
    navigate('/dashboard/add-data');
  };

  const handleViewMapping = (mapping: SavedMapping, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingMapping(mapping);
    setMappingDetailsOpen(true);
  };

  const handleCreateSchema = () => {
    setEditingSchema(null);
    setSchemaDialogOpen(true);
  };

  const handleEditSchema = (schema: Schema) => {
    setEditingSchema(schema);
    setSchemaDialogOpen(true);
  };

  const handleSaveSchema = async (schema: Schema) => {
    setIsProcessing(true);
    try {
      if (editingSchema) {
        await updateSchemaById(schema.id, schema);
      } else {
        await createSchema(schema);
      }
      setEditingSchema(null);
      setSchemaDialogOpen(false);
    } catch (error) {
      console.error('Failed to save schema:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSchema = async (id: string) => {
    const schema = schemas.find(s => s.id === id);
    if (schema) {
      setSchemaToDelete(schema);
      setShowDeleteDialog(true);
    }
  };

  const handleConfirmDelete = async (deleteTable: boolean) => {
    if (!schemaToDelete) return;
    
    setIsProcessing(true);
    try {
      await deleteSchemaById(schemaToDelete.id, deleteTable);
      setShowDeleteDialog(false);
      setSchemaToDelete(null);
    } catch (error) {
      console.error('Failed to delete schema:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportJson = async (schema: Schema) => {
    setIsProcessing(true);
    try {
      await createSchema(schema);
      setJsonImportOpen(false);
    } catch (error) {
      console.error('Failed to import schema:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateMapping = async (
    id: string, 
    name: string, 
    description: string, 
    tags: string[], 
    schemaId: string, 
    fieldMappings: any[]
  ) => {
    await updateMappingById(id, name, description, tags, schemaId, fieldMappings);
    // Refresh mappings to get the updated data
    await refreshMappings();
  };

  const getSchemaName = (schemaId: string) => {
    const schema = schemas.find(s => s.id === schemaId);
    return schema?.name || 'Unknown Schema';
  };

  return (
    <div className="flex flex-col h-full">
      <SecondaryTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "Schemas" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Schema Definitions</h2>
                <p className="text-muted-foreground">Define the structure of your clean data tables</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setJsonImportOpen(true)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Import JSON
                </Button>
                <Button onClick={handleCreateSchema}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Schema
                </Button>
              </div>
            </div>

            {isSchemasLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground">Loading schemas...</div>
              </div>
            ) : (
              <SchemaList
                schemas={schemas}
                onEdit={handleEditSchema}
                onDelete={handleDeleteSchema}
              />
            )}

            <SchemaDefinitionForm
              open={schemaDialogOpen}
              onOpenChange={setSchemaDialogOpen}
              schema={editingSchema}
              onSave={handleSaveSchema}
            />

            <SchemaJsonImport
              open={jsonImportOpen}
              onOpenChange={setJsonImportOpen}
              onImport={handleImportJson}
            />
          </div>
        )}

        {activeTab === "Mappings" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Saved Mappings</h2>
                <p className="text-muted-foreground">View and load your saved Excel data mappings</p>
              </div>
              <Button onClick={handleCreateNewMapping}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Mapping
              </Button>
            </div>

            {isMappingsLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground">Loading mappings...</div>
              </div>
            ) : savedMappings.length === 0 ? (
              <Card className="p-8 text-center">
                <FileSpreadsheet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No saved mappings yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first mapping by uploading an Excel file and defining schema fields.
                </p>
                <Button onClick={handleCreateNewMapping}>
                  Get Started
                </Button>
              </Card>
            ) : (
              // Group mappings by schema
              schemas.length > 0 ? (
                <div className="space-y-8">
                  {schemas.map((schema) => {
                    const schemaMappings = getMappingsForSchema(schema.id);
                    if (schemaMappings.length === 0) return null;
                    
                    return (
                      <div key={schema.id} className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Database className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold">{schema.name}</h3>
                          <Badge variant="outline">{schemaMappings.length} mappings</Badge>
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {schemaMappings.map((mapping) => (
                            <Card 
                              key={mapping.id} 
                              className="hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => handleLoadMapping(mapping.id)}
                            >
                              <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                  <span className="truncate">{mapping.name}</span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => handleViewMapping(mapping, e)}
                                      className="h-8 w-8"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                  </div>
                                </CardTitle>
                                <CardDescription className="line-clamp-2">
                                  {mapping.description || 'No description'}
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-1">
                                    {mapping.tags.map(tag => (
                                      <Badge key={tag} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{mapping.fieldMappings?.length || 0} fields</Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(mapping.updatedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Click to load this mapping
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Legacy mappings without schema */}
                  {savedMappings.filter(m => !m.schemaId).length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Legacy Mappings</h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {savedMappings.filter(m => !m.schemaId).map((mapping) => (
                          <Card 
                            key={mapping.id} 
                            className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleLoadMapping(mapping.id)}
                          >
                            <CardHeader>
                              <CardTitle className="flex items-center justify-between">
                                <span className="truncate">{mapping.name}</span>
                                <FileSpreadsheet className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              </CardTitle>
                              <CardDescription>
                                Created {new Date(mapping.createdAt).toLocaleDateString()}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <Badge variant="secondary">{mapping.fields?.length || 0} fields</Badge>
                                <p className="text-sm text-muted-foreground">
                                  Click to load this mapping
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <Database className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Create a schema first</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    To organize your mappings, create a schema in the Schemas tab.
                  </p>
                  <Button onClick={() => setActiveTab("Schemas")}>
                    Go to Schemas
                  </Button>
                </Card>
              )
            )}
          </div>
        )}

        {activeTab === "Business Logic" && (
          <div className="space-y-6 animate-fade-in">
            <BusinessContextEditor />
          </div>
        )}

        {activeTab === "Chat Entities" && (
          <div className="space-y-6 animate-fade-in">
            <ChatEntitiesManager />
          </div>
        )}
      </div>

      <SchemaDeleteDialog
        open={showDeleteDialog}
        schema={schemaToDelete}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <MappingDetailsSheet
        mapping={viewingMapping}
        schema={viewingMapping ? schemas.find(s => s.id === viewingMapping.schemaId) || null : null}
        open={mappingDetailsOpen}
        onOpenChange={setMappingDetailsOpen}
        onUpdate={handleUpdateMapping}
      />
    </div>
  );
};

export default ProjectConfig;
