import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Database, FileText, Hash, Calendar, Type, CheckSquare, List } from 'lucide-react';

interface SchemaField {
  id: string;
  name: string;
  displayLabel: string;
  type: string; // Simplified to string to match CleanDataTable
  description?: string;
  required?: boolean;
  enumOptions?: string[];
}

interface Schema {
  id: string;
  name: string;
  description?: string;
  fields: SchemaField[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface SchemaDescriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Schema;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'text':
      return <Type className="h-4 w-4" />;
    case 'integer':
    case 'number':
    case 'currency':
      return <Hash className="h-4 w-4" />;
    case 'date':
      return <Calendar className="h-4 w-4" />;
    case 'boolean':
      return <CheckSquare className="h-4 w-4" />;
    case 'enum':
      return <List className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'text':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'integer':
    case 'number':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'currency':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'date':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'boolean':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'enum':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function SchemaDescriptionModal({ open, onOpenChange, schema }: SchemaDescriptionModalProps) {
  const tableName = `clean_${schema.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Schema Definition: {schema.name}
          </DialogTitle>
          <DialogDescription>
            Complete schema definition and field specifications
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Schema Overview */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Table Name</h4>
              <code className="text-sm bg-muted px-2 py-1 rounded">{tableName}</code>
            </div>
            
            {schema.description && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                <p className="text-sm">{schema.description}</p>
              </div>
            )}
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{schema.fields.length} field{schema.fields.length !== 1 ? 's' : ''}</span>
              {schema.updatedAt && (
                <span>Updated {new Date(schema.updatedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          
          <Separator />
          
          {/* Fields List */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Fields</h4>
            
            <div className="space-y-3">
              {schema.fields.map((field) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {field.name}
                        </code>
                        {field.required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <h5 className="font-medium">{field.displayLabel}</h5>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getTypeIcon(field.type)}
                      <Badge 
                        variant="outline"
                        className={getTypeBadgeColor(field.type)}
                      >
                        {field.type}
                      </Badge>
                    </div>
                  </div>
                  
                  {field.description && (
                    <p className="text-sm text-muted-foreground">{field.description}</p>
                  )}
                  
                  {field.type === 'enum' && field.enumOptions && field.enumOptions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Allowed Values:</p>
                      <div className="flex flex-wrap gap-1">
                        {field.enumOptions.map((option, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {option}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}