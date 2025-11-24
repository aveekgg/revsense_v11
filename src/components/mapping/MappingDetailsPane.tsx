import { Schema } from '@/types/excel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MappingDetailsPaneProps {
  schemas: Schema[];
  mappingName: string;
  description: string;
  tagsInput: string;
  selectedSchemaId: string;
  onChange: (draft: {
    mappingName: string;
    description: string;
    tagsInput: string;
    selectedSchemaId: string;
  }) => void;
  onNext: () => void;
}

const MappingDetailsPane = ({
  schemas,
  mappingName,
  description,
  tagsInput,
  selectedSchemaId,
  onChange,
  onNext,
}: MappingDetailsPaneProps) => {
  const handleChange = (partial: Partial<{
    mappingName: string;
    description: string;
    tagsInput: string;
    selectedSchemaId: string;
  }>) => {
    onChange({
      mappingName,
      description,
      tagsInput,
      selectedSchemaId,
      ...partial,
    });
  };

  const canProceed = mappingName.trim().length > 0 && !!selectedSchemaId;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Create Mapping</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="space-y-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="mapping-name">Mapping Name</Label>
            <Input
              id="mapping-name"
              value={mappingName}
              onChange={(e) => handleChange({ mappingName: e.target.value })}
              placeholder="e.g., January P&L Mapping"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mapping-description">Description</Label>
            <Textarea
              id="mapping-description"
              value={description}
              onChange={(e) => handleChange({ description: e.target.value })}
              placeholder="Describe this mapping..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mapping-tags">Tags (comma-separated)</Label>
            <Input
              id="mapping-tags"
              value={tagsInput}
              onChange={(e) => handleChange({ tagsInput: e.target.value })}
              placeholder="e.g., quarterly, p&l, 2024"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schema-select">Select Schema (Clean Table)</Label>
            <Select
              value={selectedSchemaId}
              onValueChange={(schemaId) => handleChange({ selectedSchemaId: schemaId })}
            >
              <SelectTrigger id="schema-select">
                <SelectValue placeholder="Choose a schema..." />
              </SelectTrigger>
              <SelectContent>
                {schemas.map((schema) => (
                  <SelectItem key={schema.id} value={schema.id}>
                    {schema.name} ({schema.fields.length} fields)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t">
          <Button className="w-full" onClick={onNext} disabled={!canProceed}>
            Next: Map Fields
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MappingDetailsPane;
