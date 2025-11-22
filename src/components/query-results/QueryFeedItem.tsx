import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SQLViewer } from './SQLViewer';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import { Clock, Save, Info } from 'lucide-react';
import { SaveToDashboardDialog } from '@/components/dashboard/SaveToDashboardDialog';
import { useDashboardCharts } from '@/hooks/useDashboardCharts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QueryFeedItemProps {
  id: string;
  timestamp: string;
  summary: string;
  sql?: string;
  result?: any[];
  chartType?: 'bar' | 'line' | 'pie' | 'area';
  chartConfig?: any;
  scrollTo?: boolean;
  originalQuery?: string;
  cleanedQuery?: string;
}

export const QueryFeedItem = ({
  id,
  timestamp,
  summary,
  sql,
  result,
  chartType,
  chartConfig,
  scrollTo,
  originalQuery,
  cleanedQuery,
}: QueryFeedItemProps) => {
  const hasSQL = !!sql;
  const hasTable = !!result && result.length > 0;
  const hasChart = hasTable && !!chartType;
  const canSave = hasSQL && hasTable;
  
  // Set default tab to first available: sql -> table -> chart
  const defaultTab = hasSQL ? 'sql' : hasTable ? 'table' : hasChart ? 'chart' : 'sql';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  const { addChart, isAdding } = useDashboardCharts();

  const handleSaveToDashboard = (dashboardId: string, title: string) => {
    if (!sql || !result) return;

    addChart({
      dashboard_id: dashboardId,
      title,
      sql_query: sql,
      chart_type: chartType || 'table',
      config: {
        ...chartConfig,
        lastResult: result,
        lastRefreshed: new Date().toISOString(),
      },
    });
  };

  return (
    <Card 
      id={`query-${id}`} 
      className={`transition-all ${scrollTo ? 'ring-2 ring-primary' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold mb-1">Query Result</CardTitle>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {cleanedQuery || summary}
              </p>
              {originalQuery && cleanedQuery && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs font-semibold mb-1">Original Query:</p>
                      <p className="text-xs">{originalQuery}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                disabled={isAdding}
                className="h-8"
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
              <Clock className="h-3 w-3" />
              {new Date(timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {(hasSQL || hasTable || hasChart) ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 grid w-full" style={{ gridTemplateColumns: `repeat(${[hasSQL, hasTable, hasChart].filter(Boolean).length}, 1fr)` }}>
              {hasSQL && <TabsTrigger value="sql" className="text-xs">SQL Query</TabsTrigger>}
              {hasTable && <TabsTrigger value="table" className="text-xs">Table View</TabsTrigger>}
              {hasChart && <TabsTrigger value="chart" className="text-xs">Chart</TabsTrigger>}
            </TabsList>

            {hasSQL && (
              <TabsContent value="sql" className="mt-3">
                <SQLViewer sql={sql} />
              </TabsContent>
            )}

            {hasTable && (
              <TabsContent value="table" className="mt-3">
                <ChartRenderer type="table" data={result} />
              </TabsContent>
            )}

            {hasChart && chartType && (
              <TabsContent value="chart" className="mt-3">
                <ChartRenderer 
                  type={chartType} 
                  data={result} 
                  config={chartConfig}
                />
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <Badge variant="secondary" className="text-xs">No visualization available</Badge>
        )}
      </CardContent>

      <SaveToDashboardDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveToDashboard}
        defaultTitle={summary}
        isLoading={isAdding}
      />
    </Card>
  );
};
