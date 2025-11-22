import { SavedMapping, Schema } from "@/types/excel";
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
import { Calendar, FileSpreadsheet, Database, Code } from "lucide-react";

interface MappingDetailsSheetProps {
  mapping: SavedMapping | null;
  schema: Schema | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MappingDetailsSheet = ({ mapping, schema, open, onOpenChange }: MappingDetailsSheetProps) => {
  if (!mapping) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {mapping.name}
          </SheetTitle>
          <SheetDescription>
            {mapping.description || "No description provided"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] pr-4 mt-6">
          <div className="space-y-6">
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

                {mapping.tags && mapping.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {mapping.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Field Mappings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Field Mappings</CardTitle>
                <CardDescription>
                  {mapping.fieldMappings?.length || 0} fields mapped
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mapping.fieldMappings && mapping.fieldMappings.length > 0 ? (
                  mapping.fieldMappings.map((fieldMapping, index) => {
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
                            <code className="text-xs text-foreground break-all">
                              {fieldMapping.formula || "No formula"}
                            </code>
                          </div>

                          {fieldMapping.cellReferences && fieldMapping.cellReferences.length > 0 && (
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
