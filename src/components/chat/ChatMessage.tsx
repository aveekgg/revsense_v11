import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, Info, Table as TableIcon, BarChart3, Loader2, List, Grid3x3 } from 'lucide-react';
import { SQLViewer } from '@/components/query-results/SQLViewer';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import { CanonicalChartRenderer, ChartConfig, CanonicalRow } from '@/components/charts/CanonicalChartRenderer';
import { CanonicalDataTable } from '@/components/query-results/CanonicalDataTable';
import { SaveToDashboardDialog } from '@/components/dashboard/SaveToDashboardDialog';
import { useChatEntities } from '@/hooks/useChatEntities';
import { useDashboardCharts } from '@/hooks/useDashboardCharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatMessageProps {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  dataSummary?: string;
  sqlQuery?: string;
  queryResult?: any;
  chartSuggestion?: {
    chartType: 'bar' | 'line' | 'pie' | 'area' | 'table' | 'combo';
    config: any;
    data?: any; // Optional data property for canonical charts
  };
  metadata?: {
    originalQuery?: string;
    cleanedQuery?: string;
  };
}

export const ChatMessage = ({
  id,
  sessionId,
  role,
  content,
  dataSummary,
  sqlQuery,
  queryResult,
  chartSuggestion,
  metadata,
}: ChatMessageProps) => {
  const hasTable = !!queryResult && Array.isArray(queryResult) && queryResult.length > 0;
  const canSave = !!sqlQuery && hasTable;
  const queryClient = useQueryClient();
  
  // Get all entities for mention processing
  const { entities: allEntities } = useChatEntities();

  // Function to process content and replace @mentions with entity names + types
  const processContentWithMentions = (text: string) => {
    if (!text || !allEntities) return text;

    // Create a map of entity names/IDs to entities for quick lookup
    const entityMap = new Map<string, typeof allEntities[0]>();
    allEntities.forEach(entity => {
      entityMap.set(entity.name.toLowerCase(), entity);
      entityMap.set(entity.id, entity);
      // Also add tags to the map
      if (entity.tags) {
        entity.tags.forEach(tag => {
          entityMap.set(tag.toLowerCase(), entity);
        });
      }
    });

    // Replace @mentions
    return text.replace(/@(\w+)/g, (match, mention) => {
      const entity = entityMap.get(mention.toLowerCase());
      if (entity) {
        const typeLabel = entity.type === 'legal_entity' ? 'legal entity' : entity.type;
        return `${entity.name} (${typeLabel})`;
      }
      return match; // Keep original if not found
    });
  };
  
  // Check if data is in canonical format
  const isCanonicalFormat = hasTable && queryResult.length > 0 && 
    'period' in queryResult[0] && 
    'metric_name' in queryResult[0] && 
    'entity_name' in queryResult[0];
  
  const [showTable, setShowTable] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [generatedChart, setGeneratedChart] = useState(chartSuggestion);
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  // Sync generatedChart state with chartSuggestion prop when it changes
  // This ensures that after page reload, if chart_suggestion exists in DB, it shows up
  useEffect(() => {
    if (chartSuggestion) {
      setGeneratedChart(chartSuggestion);
    }
  }, [chartSuggestion]);
  
  // Calculate column count for canonical data and set smart default
  const pivotedColumnCount = useMemo(() => {
    if (!isCanonicalFormat || !queryResult || queryResult.length === 0) return 0;
    
    const entities = new Set(queryResult.map((r: CanonicalRow) => r.entity_name));
    const metrics = new Set(queryResult.map((r: CanonicalRow) => r.metric_name));
    return entities.size * metrics.size + 1; // +1 for Period column
  }, [isCanonicalFormat, queryResult]);
  
  // Smart default: long form if more than 6 columns, pivot otherwise
  const defaultTableView = pivotedColumnCount > 6 ? 'long' : 'pivot';
  const [tableViewMode, setTableViewMode] = useState<'long' | 'pivot'>(defaultTableView);
  
  const { addChart, isAdding } = useDashboardCharts();
  const { toast } = useToast();

  const handleGenerateChart = async () => {
    if (generatedChart) {
      setShowChart(!showChart);
      return;
    }
    
    setIsGeneratingChart(true);
    try {
      const response = await supabase.functions.invoke('ai-chart-generator', {
        body: {
          queryResult,
          cleanedQuery: metadata?.cleanedQuery || content,
          sqlQuery
        }
      });
      
      if (response.error) throw response.error;
      
      setGeneratedChart(response.data);
      setShowChart(true);
      
      // Update message in DB with generated chart
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ chart_suggestion: response.data })
        .eq('id', id);
      
      if (updateError) {
        console.error('Failed to save chart suggestion to database:', updateError);
        toast({
          title: 'Warning',
          description: 'Chart generated but not saved to database',
          variant: 'destructive'
        });
      } else {
        console.log('Chart suggestion saved to database successfully');
        // Invalidate chat messages cache to reflect the updated chart_suggestion
        queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] });
      }
        
    } catch (error) {
      toast({
        title: 'Chart generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingChart(false);
    }
  };

  const handleSaveToDashboard = async (dashboardId: string, title: string) => {
    if (!sqlQuery || !queryResult) return;

    let chartConfig = generatedChart;
    
    // Auto-generate chart if not already generated
    if (!chartConfig) {
      setIsGeneratingChart(true);
      try {
        const response = await supabase.functions.invoke('ai-chart-generator', {
          body: {
            queryResult,
            cleanedQuery: metadata?.cleanedQuery || content,
            sqlQuery
          }
        });
        
        if (response.error) throw response.error;
        chartConfig = response.data;
        setGeneratedChart(chartConfig);
        
      } catch (error) {
        toast({
          title: 'Chart generation failed',
          description: 'Saving with table view only',
        });
        chartConfig = { chartType: 'table', config: {} };
      } finally {
        setIsGeneratingChart(false);
      }
    }

    // Handle both old and new chart format
    const chartType = chartConfig.config?.chartType || chartConfig.chartType || 'table';
    const config = chartConfig.config || {};

    addChart({
      dashboard_id: dashboardId,
      title,
      sql_query: sqlQuery,
      chart_type: chartType,
      config: {
        ...config,
        // Store canonical data if available, otherwise store original query result
        lastResult: chartConfig.data || queryResult,
        lastRefreshed: new Date().toISOString(),
      },
    });
  };

  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}>
      <Card className={`max-w-full ${role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
        <CardContent className="p-4">
          {metadata?.cleanedQuery && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">Query:</span>
              <span className="text-muted-foreground">{metadata.cleanedQuery}</span>
              {metadata.originalQuery && metadata.originalQuery !== metadata.cleanedQuery && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs font-semibold mb-1">Original Query:</p>
                      <p className="text-xs">{metadata.originalQuery}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
          
          <div className="whitespace-pre-wrap mb-3">{processContentWithMentions(dataSummary || content)}</div>

          {hasTable && (
            <div className="flex gap-2 mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTable(!showTable)}
              >
                <TableIcon className="h-4 w-4 mr-2" />
                {showTable ? 'Hide' : 'Show'} Table
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGenerateChart}
                disabled={isGeneratingChart}
              >
                {isGeneratingChart ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    {generatedChart ? (showChart ? 'Hide' : 'Show') : 'Generate'} Chart
                  </>
                )}
              </Button>

              {canSave && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={isAdding || isGeneratingChart}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Add to Dashboard
                </Button>
              )}
            </div>
          )}

          {showTable && hasTable && (
            <div className="mb-3">
              {isCanonicalFormat && (
                <div className="flex justify-end mb-2">
                  <div className="inline-flex items-center gap-1 rounded-md border bg-muted p-1">
                    <Button
                      variant={tableViewMode === 'pivot' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setTableViewMode('pivot')}
                      title="Pivot view - metrics as columns"
                    >
                      <Grid3x3 className="h-3.5 w-3.5 mr-1" />
                      Pivot
                    </Button>
                    <Button
                      variant={tableViewMode === 'long' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setTableViewMode('long')}
                      title="Long view - canonical format"
                    >
                      <List className="h-3.5 w-3.5 mr-1" />
                      Long
                    </Button>
                  </div>
                </div>
              )}
              
              {isCanonicalFormat ? (
                <CanonicalDataTable data={queryResult as CanonicalRow[]} viewMode={tableViewMode} />
              ) : (
                <ChartRenderer type="table" data={queryResult} />
              )}
            </div>
          )}

          {showChart && generatedChart && (
            <div className="mb-3">
              {generatedChart.config && generatedChart.data ? (
                <CanonicalChartRenderer 
                  config={generatedChart.config as ChartConfig}
                  data={generatedChart.data as CanonicalRow[]}
                />
              ) : (
                <ChartRenderer 
                  type={generatedChart.chartType} 
                  data={queryResult} 
                  config={generatedChart.config}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {canSave && (
        <SaveToDashboardDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          onSave={handleSaveToDashboard}
          defaultTitle={metadata?.cleanedQuery || content.substring(0, 50)}
          isLoading={isAdding}
        />
      )}
    </div>
  );
};
