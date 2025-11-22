import { Schema } from '@/types/excel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Edit, Trash2 } from 'lucide-react';

interface SchemaListProps {
  schemas: Schema[];
  onEdit: (schema: Schema) => void;
  onDelete: (id: string) => void;
}

const SchemaList = ({ schemas, onEdit, onDelete }: SchemaListProps) => {
  if (schemas.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Database className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No schemas defined yet</h3>
        <p className="text-sm text-muted-foreground">
          Create your first schema to define the structure of your clean data tables.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {schemas.map((schema) => (
        <Card key={schema.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="truncate">{schema.name}</span>
              <Database className="h-5 w-5 text-primary flex-shrink-0" />
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {schema.description || 'No description'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{schema.fields.length} fields</Badge>
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(schema.updatedAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(schema)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(schema.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SchemaList;
