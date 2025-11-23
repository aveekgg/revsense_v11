import { useSupabaseSchemaTable } from '@/hooks/useSupabaseSchemaTable';
import { CleanDataTable } from './CleanDataTable';
import { QueryClient } from '@tanstack/react-query';
import { toast } from "@/hooks/use-toast";

interface Schema {
  id: string;
  name: string;
  description?: string;
  fields: any[];
}

interface SchemaTableWrapperProps {
  schema: Schema;
  queryClient: QueryClient;
}

export function SchemaTableWrapper({ schema, queryClient }: SchemaTableWrapperProps) {
  const { records, isLoading, deleteRecord, clearTable, deleteFilteredRecords } = useSupabaseSchemaTable(schema.name);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['schema-table-data'] });
    toast({ title: "Refreshing data..." });
  };

  const handleDeleteRecord = async (recordId: string) => {
    await deleteRecord(recordId);
  };

  const handleClearTable = async () => {
    await clearTable();
  };

  const handleDeleteFilteredRecords = async (recordIds: string[]) => {
    await deleteFilteredRecords(recordIds);
  };

  return (
    <CleanDataTable
      schema={schema}
      records={records}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      onClearAll={handleClearTable}
      onDeleteRecord={handleDeleteRecord}
      onDeleteFilteredRecords={handleDeleteFilteredRecords}
    />
  );
}
