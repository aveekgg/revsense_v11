import { SavedMapping, Schema, FieldMapping } from "@/types/excel";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, FileSpreadsheet, Database, Code, Edit2, Save, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MappingDetailsSheetProps {
  mapping: SavedMapping | null;
  schema: Schema | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (id: string, name: string, description: string, tags: string[], schemaId: string, fieldMappings: FieldMapping[]) => Promise<void>;
}

const MappingDetailsSheet = ({ mapping, schema, open, onOpenChange, onUpdate }: MappingDetailsSheetProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedTags, setEditedTags] = useState("");
  const [editedFieldMappings, setEditedFieldMappings] = useState<FieldMapping[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when mapping changes or sheet closes
  useEffect(() => {
    if (mapping) {
      setEditedName(mapping.name);
      setEditedDescription(mapping.description || "");
      setEditedTags(mapping.tags.join(", "));
      setEditedFieldMappings(mapping.fieldMappings || []);
      setIsEditMode(false);
    }
  }, [mapping, open]);

  if (!mapping) return null;

  const handleEditMode = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    // Restore original values
    setEditedName(mapping.name);
    setEditedDescription(mapping.description || "");
    setEditedTags(mapping.tags.join(", "));
    setEditedFieldMappings(mapping.fieldMappings || []);
    setIsEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!onUpdate || !schema) {
      toast({
        title: "Update not available",
        description: "Update functionality is not configured.",
        variant: "destructive",
      });
      return;
    }

    if (!editedName.trim()) {
      toast({
        title: "Name required",
        description: "Mapping name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const tags = editedTags.split(',').map(t => t.trim()).filter(Boolean);
      await onUpdate(mapping.id, editedName, editedDescription, tags, mapping.schemaId, editedFieldMappings);
      
      toast({
        title: "Mapping updated",
        description: "Your changes have been saved successfully.",
      });
      setIsEditMode(false);
    } catch (error) {
      console.error('Failed to update mapping:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update mapping.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateFieldFormula = (fieldId: string, newFormula: string) => {
    setEditedFieldMappings(prev => 
      prev.map(fm => 
        fm.schemaFieldId === fieldId 
          ? { ...fm, formula: newFormula }
          : fm
      )
    );
  };

  if (!mapping) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {isEditMode ? (
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="flex-1"
                placeholder="Mapping name"
              />
            ) : (
              mapping.name
            )}
          </SheetTitle>
          <SheetDescription>
            {isEditMode ? (
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Mapping description"
                rows={2}
                className="mt-2"
              />
            ) : (
              mapping.description || "No description provided"
            )}
          </SheetDescription>
          <div className="flex gap-2 pt-2">
            {isEditMode ? (
              <>
                <Button 
                  size="sm" 
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              onUpdate && (
                <Button size="sm" variant="outline" onClick={handleEditMode}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Mapping
                </Button>
              )
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-12rem)] pr-4 mt-6">
          <div className="space-y-6 pb-8">
            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Mapping Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Schema:</span>
                  <span className="text-muted-foreground">{schema?.name || "Unknown"}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Created:</span>
                  <span className="text-muted-foreground">
                    {new Date(mapping.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Last Updated:</span>
                  <span className="text-muted-foreground">
                    {new Date(mapping.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                {mapping.workbookFormat && (
                  <div className="flex items-start gap-2 text-sm">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-medium">Workbook Format:</span>
                      <p className="text-muted-foreground mt-1">{mapping.workbookFormat}</p>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <span className="text-sm font-medium">Tags:</span>
                  {isEditMode ? (
                    <Input
                      value={editedTags}
                      onChange={(e) => setEditedTags(e.target.value)}
                      placeholder="Enter tags separated by commas"
                      className="mt-2"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mapping.tags && mapping.tags.length > 0 ? (
                        mapping.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No tags</span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Field Mappings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Field Mappings</CardTitle>
                <CardDescription>
                  {(isEditMode ? editedFieldMappings : mapping.fieldMappings)?.length || 0} fields mapped
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(isEditMode ? editedFieldMappings : mapping.fieldMappings) && 
                 (isEditMode ? editedFieldMappings : mapping.fieldMappings).length > 0 ? (
                  (isEditMode ? editedFieldMappings : mapping.fieldMappings).map((fieldMapping, index) => {
                    const schemaField = schema?.fields.find(f => f.id === fieldMapping.schemaFieldId);
                    
                    return (
                      <div key={fieldMapping.schemaFieldId} className="space-y-2">
                        {index > 0 && <Separator />}
                        
                        <div className="space-y-2 pt-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {schemaField?.displayLabel || "Unknown Field"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {schemaField?.name}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {schemaField?.type || "unknown"}
                            </Badge>
                          </div>

                          {schemaField?.description && (
                            <p className="text-xs text-muted-foreground">
                              {schemaField.description}
                            </p>
                          )}

                          <div className="bg-muted/50 p-3 rounded-md">
                            <div className="flex items-center gap-2 mb-2">
                              <Code className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium">Formula:</span>
                            </div>
                            {isEditMode ? (
                              <Textarea
                                value={fieldMapping.formula || ""}
                                onChange={(e) => handleUpdateFieldFormula(fieldMapping.schemaFieldId, e.target.value)}
                                placeholder="Enter formula (e.g., A1, CONCAT(A1, B1))"
                                className="font-mono text-xs"
                                rows={2}
                              />
                            ) : (
                              <code className="text-xs text-foreground break-all">
                                {fieldMapping.formula || "No formula"}
                              </code>
                            )}
                          </div>

                          {!isEditMode && fieldMapping.cellReferences && fieldMapping.cellReferences.length > 0 && (
                            <div className="text-xs">
                              <span className="font-medium">Cell References:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {fieldMapping.cellReferences.map((ref, refIndex) => (
                                  <Badge key={refIndex} variant="secondary" className="text-xs font-mono">
                                    {ref.pattern || `${ref.sheet}!${ref.cell}`}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {schemaField?.required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No field mappings defined
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default MappingDetailsSheet;
