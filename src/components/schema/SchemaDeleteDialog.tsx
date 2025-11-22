import { useState } from 'react';
import { Schema } from '@/types/excel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface SchemaDeleteDialogProps {
  open: boolean;
  schema: Schema | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteTable: boolean) => void;
}

export const SchemaDeleteDialog = ({
  open,
  schema,
  onOpenChange,
  onConfirm,
}: SchemaDeleteDialogProps) => {
  const [deleteTable, setDeleteTable] = useState(false);

  const handleConfirm = () => {
    onConfirm(deleteTable);
    setDeleteTable(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setDeleteTable(false);
  };

  if (!schema) return null;

  const tableName = `clean_${schema.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Schema: {schema.name}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              This action will delete the schema definition. The schema contains{' '}
              <strong>{schema.fields.length} fields</strong>.
            </p>
            
            <p className="text-sm">
              Associated database table: <code className="bg-muted px-2 py-1 rounded">{tableName}</code>
            </p>

            <div className="flex items-start space-x-2 pt-4 border-t">
              <Checkbox 
                id="delete-table" 
                checked={deleteTable}
                onCheckedChange={(checked) => setDeleteTable(checked === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="delete-table"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Delete associated table and ALL data
                </Label>
                <p className="text-sm text-muted-foreground">
                  {deleteTable 
                    ? '⚠️ This will permanently delete all data in this table. This cannot be undone.'
                    : 'The table and its data will be kept. You can recreate the schema later.'}
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteTable ? 'Delete Everything' : 'Delete Schema Only'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
