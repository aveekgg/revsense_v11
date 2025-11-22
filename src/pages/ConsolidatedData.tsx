import { useExcel } from '@/contexts/ExcelContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Code, BarChart3 } from "lucide-react";
import { useLocation } from 'react-router-dom';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import { useQueryClient } from '@tanstack/react-query';
import { SchemaTableWrapper } from '@/components/consolidated/SchemaTableWrapper';

const ConsolidatedData = () => {
  const { schemas } = useExcel();
  const location = useLocation();
  const visualization = location.state?.visualization;
  const queryClient = useQueryClient();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 animate-fade-in">
          <div>
            <h2 className="text-2xl font-bold">Consolidated Data</h2>
            <p className="text-muted-foreground">View and export data extracted from workbooks</p>
          </div>

          {schemas.length === 0 ? (
            <Card className="p-8 text-center">
              <Database className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No schemas defined yet</h3>
              <p className="text-sm text-muted-foreground">Create schemas in Project Config to start.</p>
            </Card>
          ) : (
            <>
              {schemas.map(schema => (
                <SchemaTableWrapper key={schema.id} schema={schema} queryClient={queryClient} />
              ))}

              {visualization && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {visualization.type === 'sql' && <Code className="h-5 w-5" />}
                      {visualization.type === 'table' && <Database className="h-5 w-5" />}
                      {visualization.type === 'chart' && <BarChart3 className="h-5 w-5" />}
                      AI Query Results
                    </CardTitle>
                    <CardDescription>Results from your conversation with the AI assistant</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {visualization.type === 'sql' && (
                      <pre className="bg-muted p-4 rounded text-sm overflow-x-auto border">
                        <code>{visualization.data.sql}</code>
                      </pre>
                    )}
                    
                    {visualization.type === 'table' && visualization.data.data && (
                      <div className="overflow-auto">
                        <ChartRenderer
                          type="table"
                          data={visualization.data.data}
                        />
                      </div>
                    )}
                    
                    {visualization.type === 'chart' && visualization.data.data && (
                      <div className="p-4">
                        <ChartRenderer
                          type={visualization.data.type}
                          data={visualization.data.data}
                          config={visualization.data.config}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsolidatedData;
