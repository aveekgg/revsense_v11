import { useState } from 'react';
import { useExcel } from '@/contexts/ExcelContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Code, BarChart3 } from "lucide-react";
import { useLocation } from 'react-router-dom';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import { useQueryClient } from '@tanstack/react-query';
import { SchemaTableWrapper } from '@/components/consolidated/SchemaTableWrapper';
import SecondaryTabs from '@/components/layout/SecondaryTabs';

const ConsolidatedData = () => {
  const { schemas } = useExcel();
  const location = useLocation();
  const visualization = location.state?.visualization;
  const queryClient = useQueryClient();

  // Tab management
  const [activeTab, setActiveTab] = useState<string>(schemas.length > 0 ? schemas[0].name : '');

  // Update active tab when schemas change
  const tabNames = schemas.map(schema => schema.name);
  const currentSchema = schemas.find(schema => schema.name === activeTab);

  // If current active tab doesn't exist in schemas, select first available
  if (schemas.length > 0 && !currentSchema) {
    setActiveTab(schemas[0].name);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <div className="space-y-6 animate-fade-in">
          <div className="p-6 pb-0">
            <h2 className="text-2xl font-bold">Consolidated Data</h2>
            <p className="text-muted-foreground">View and export data extracted from workbooks</p>
          </div>

          {schemas.length === 0 ? (
            <div className="p-6">
              <Card className="p-8 text-center">
                <Database className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No schemas defined yet</h3>
                <p className="text-sm text-muted-foreground">Create schemas in Project Config to start.</p>
              </Card>
            </div>
          ) : (
            <>
              {/* Schema Tabs */}
              <SecondaryTabs 
                tabs={tabNames}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {/* Active Schema Content */}
              <div className="p-6 pt-4">
                {currentSchema && (
                  <SchemaTableWrapper key={currentSchema.id} schema={currentSchema} queryClient={queryClient} />
                )}
              </div>
            </>
          )}

          {visualization && (
            <div className="p-6 pt-0">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsolidatedData;
