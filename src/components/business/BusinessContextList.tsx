import { BusinessContext } from '@/hooks/useSupabaseBusinessContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Edit, Trash2 } from 'lucide-react';

interface BusinessContextListProps {
  contexts: BusinessContext[];
  onEdit: (context: BusinessContext) => void;
  onDelete: (id: string) => void;
}

const BusinessContextList = ({ contexts, onEdit, onDelete }: BusinessContextListProps) => {
  if (contexts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No business context defined yet</h3>
        <p className="text-sm text-muted-foreground">
          Add business context to help the AI understand your data and answer questions accurately.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {contexts.map((context) => (
        <Card key={context.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="truncate">{context.name}</span>
              <Brain className="h-5 w-5 text-primary flex-shrink-0" />
            </CardTitle>
            <CardDescription>
              <Badge variant="secondary" className="text-xs">
                {context.contextType}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {context.definition}
              </p>
              
              {context.examples && context.examples.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold">{context.examples.length} examples</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(context)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(context.id)}
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

export default BusinessContextList;
