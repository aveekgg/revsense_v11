import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Play, Wand2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import { CanonicalChartRenderer } from '@/components/charts/CanonicalChartRenderer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDashboardCharts } from '@/hooks/useDashboardCharts';

interface AddChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  editChart?: {
    id: string;
    title: string;
    sql_query: string;
    chart_type: string;
    config: any;
  };
}

interface ChartPreview {
  data: any[];
  config: any;
  chartType: string;
}

export const AddChartDialog = ({ open, onOpenChange, dashboardId, editChart }: AddChartDialogProps) => {
  const [activeTab, setActiveTab] = useState('query');
  const [sqlQuery, setSqlQuery] = useState('');
  const [chartTitle, setChartTitle] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'area' | 'combo' | 'table'>('bar');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [showLegend, setShowLegend] = useState(true);
  const [showTooltip, setShowTooltip] = useState(true);
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [showOriginalValues, setShowOriginalValues] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);
  const [queryResult, setQueryResult] = useState<any[]>([]);
  const [chartConfig, setChartConfig] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isCanonicalData, setIsCanonicalData] = useState(false);

  // Enhanced configuration state
  const [enhancedConfig, setEnhancedConfig] = useState({
    title: '',
    xAxis: {
      key: '',
      label: '',
      type: 'category' as 'category' | 'datetime',
    },
    yAxes: [
      {
        id: 'left',
        label: '',
        type: 'linear' as 'linear' | 'log',
        scale: 'auto' as 'auto' | 'thousands' | 'lakhs' | 'millions' | 'crores',
        format: 'number' as 'number' | 'currency' | 'percentage',
        decimals: 0,
      },
      {
        id: 'right',
        label: '',
        type: 'linear' as 'linear' | 'log',
        scale: 'auto' as 'auto' | 'thousands' | 'lakhs' | 'millions' | 'crores',
        format: 'number' as 'number' | 'currency' | 'percentage',
        decimals: 0,
      },
    ],
    series: [] as Array<{
      id: string;
      dataKey: string;
      label: string;
      type: 'bar' | 'line' | 'area';
      yAxisId: 'left' | 'right';
      color: string;
      stackId?: string;
      metric_name?: string;
      entity_name?: string;
    }>,
    showLegend: true,
    showTooltip: true,
    showDataLabels: false,
    showOriginalValues: false,
  });

  const { addChart, updateChart, isAdding, isUpdating } = useDashboardCharts();
  const { toast } = useToast();

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (editChart) {
        // Edit mode: populate with existing chart data
        setSqlQuery(editChart.sql_query);
        setChartTitle(editChart.title);
        setChartType(editChart.chart_type as any);
        setXAxis(editChart.config?.xAxis || editChart.config?.xLabel || editChart.config?.xKey || '');
        setYAxis(editChart.config?.yAxis || (editChart.config?.yAxes?.[0]?.label) || '');
        setShowLegend(editChart.config?.showLegend ?? true);
        setShowTooltip(editChart.config?.showTooltip ?? true);
        setQueryResult(editChart.config?.lastResult || []);
        setChartConfig(editChart.config);
        setShowPreview(true);
        setActiveTab('query'); // Start with query tab when editing

        // Detect if data is in canonical format
        const data = editChart.config?.lastResult || [];
        setIsCanonicalData(data.length > 0 && 'metric_name' in data[0] && 'entity_name' in data[0] && 'metric_value' in data[0]);

        // Initialize enhanced config from existing config
        if (editChart.config) {
          setEnhancedConfig({
            title: editChart.config.title || editChart.title || '',
            xAxis: {
              key: editChart.config.xKey || editChart.config.xAxis || '',
              label: editChart.config.xLabel || '',
              type: editChart.config.xAxisType || 'category',
            },
            yAxes: editChart.config.yAxes ? editChart.config.yAxes.map((axis: any) => ({
              id: axis.id,
              label: axis.label || '',
              type: axis.type === 'percentage' ? 'linear' : (axis.type === 'absolute' ? 'linear' : 'linear'), // Convert canonical type to enhanced type
              scale: axis.scale || 'auto',
              format: axis.format || 'number',
              decimals: axis.decimals || 0,
            })) : [
              {
                id: 'left',
                label: editChart.config.yAxis || '',
                type: 'linear',
                scale: 'auto',
                format: 'number',
                decimals: 0,
              },
              {
                id: 'right',
                label: '',
                type: 'linear',
                scale: 'auto',
                format: 'number',
                decimals: 0,
              },
            ],
            series: editChart.config.series ? editChart.config.series.map((s: any, index: number) => ({
              id: s.id || `series_${index}`,
              dataKey: isCanonicalData ? 'metric_value' : (s.dataKey || s.metric_name || 'metric_value'),
              label: s.label || `Series ${index + 1}`,
              type: s.type || 'bar',
              yAxisId: s.yAxisId || 'left',
              color: s.color || `hsl(var(--chart-${index + 1}))`,
              stackId: s.stackId,
              // Store canonical fields for proper saving
              metric_name: s.metric_name,
              entity_name: s.entity_name,
            })) : [],
            showLegend: editChart.config.showLegend ?? true,
            showTooltip: editChart.config.showTooltip ?? true,
            showDataLabels: editChart.config.showDataLabels ?? false,
            showOriginalValues: editChart.config.showOriginalValues ?? false,
          });
        }
      } else {
        // Create mode: reset form
        setSqlQuery('');
        setChartTitle('');
        setChartType('bar');
        setXAxis('');
        setYAxis('');
        setShowLegend(true);
        setShowTooltip(true);
        setQueryResult([]);
        setChartConfig(null);
        setShowPreview(false);
        setActiveTab('query');

        // Reset enhanced config
        setEnhancedConfig({
          title: '',
          xAxis: {
            key: '',
            label: '',
            type: 'category',
          },
          yAxes: [
            {
              id: 'left',
              label: '',
              type: 'linear',
              scale: 'auto',
              format: 'number',
              decimals: 0,
            },
            {
              id: 'right',
              label: '',
              type: 'linear',
              scale: 'auto',
              format: 'number',
              decimals: 0,
            },
          ],
          series: [],
          showLegend: true,
          showTooltip: true,
          showDataLabels: false,
          showOriginalValues: false,
        });
      }
    }
  }, [open, editChart, isCanonicalData]);

  // Helper functions for enhanced config
  const updateEnhancedConfig = (updates: Partial<typeof enhancedConfig>) => {
    setEnhancedConfig(prev => ({ ...prev, ...updates }));
  };

  const updateXAxis = (updates: Partial<typeof enhancedConfig.xAxis>) => {
    setEnhancedConfig(prev => ({
      ...prev,
      xAxis: { ...prev.xAxis, ...updates }
    }));
  };

  const updateYAxis = (axisId: string, updates: Partial<typeof enhancedConfig.yAxes[0]>) => {
    setEnhancedConfig(prev => ({
      ...prev,
      yAxes: prev.yAxes.map(axis =>
        axis.id === axisId ? { ...axis, ...updates } : axis
      )
    }));
  };

  const addSeries = () => {
    const newSeries = {
      id: `series_${Date.now()}`,
      dataKey: isCanonicalData ? 'metric_value' : '',
      label: '',
      type: chartType === 'combo' ? 'bar' : chartType as 'bar' | 'line' | 'area',
      yAxisId: 'left' as 'left' | 'right',
      color: `hsl(var(--chart-${enhancedConfig.series.length + 1}))`,
      stackId: undefined,
      metric_name: isCanonicalData ? '' : undefined,
      entity_name: isCanonicalData ? '' : undefined,
    };
    setEnhancedConfig(prev => ({
      ...prev,
      series: [...prev.series, newSeries]
    }));
  };

  const updateSeries = (index: number, updates: Partial<typeof enhancedConfig.series[0]>) => {
    setEnhancedConfig(prev => ({
      ...prev,
      series: prev.series.map((s, i) => i === index ? { ...s, ...updates } : s)
    }));
  };

  const removeSeries = (index: number) => {
    setEnhancedConfig(prev => ({
      ...prev,
      series: prev.series.filter((_, i) => i !== index)
    }));
  };

  // Get available columns from query result
  const availableColumns = queryResult.length > 0 ? Object.keys(queryResult[0]) : [];

  const executeQuery = async () => {
    if (!(sqlQuery?.trim())) {
      toast({
        title: 'Error',
        description: 'Please enter a SQL query',
        variant: 'destructive',
      });
      return;
    }

    setIsExecuting(true);
    try {
      const { data, error } = await supabase.rpc('execute_safe_query', {
        query_text: sqlQuery,
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(String(data.error));
      }

      const resultArray = Array.isArray(data) ? data : [];
      setQueryResult(resultArray);
      toast({
        title: 'Query executed',
        description: `Found ${resultArray.length} rows`,
      });
    } catch (error) {
      toast({
        title: 'Query failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const generateChartConfig = async () => {
    if (!queryResult || queryResult.length === 0) {
      toast({
        title: 'No data',
        description: 'Please execute a query first to generate chart configuration',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await supabase.functions.invoke('ai-chart-generator', {
        body: {
          queryResult,
          cleanedQuery: sqlQuery,
          sqlQuery,
          chartType, // Pass the selected chart type to AI
        },
      });

      if (response.error) throw response.error;

      const { config: generatedConfig, data: processedData } = response.data;

      // Update data if AI processed it differently
      if (processedData && processedData.length > 0) {
        setQueryResult(processedData);
        setIsCanonicalData(processedData.length > 0 && 'metric_name' in processedData[0] && 'entity_name' in processedData[0] && 'metric_value' in processedData[0]);
      }

      // Determine if we're working with canonical data
      const currentData = processedData || queryResult;
      const isCanonical = currentData.length > 0 && 'metric_name' in currentData[0] && 'entity_name' in currentData[0];

      // Extract available columns for form validation
      const availableColumns = currentData.length > 0 ? Object.keys(currentData[0]) : [];

      // Generate comprehensive enhanced config from AI response
      const enhancedSeries = generatedConfig.series ? generatedConfig.series.map((s: any, index: number) => {
        // For canonical data, use metric_value as dataKey, otherwise use the series dataKey or find appropriate column
        const dataKey = isCanonical ? 'metric_value' :
          (s.dataKey || s.metric_name || availableColumns.find(col => col !== (generatedConfig.xKey || generatedConfig.xAxis)) || availableColumns[0] || '');

        return {
          id: s.id || `series_${index}`,
          dataKey,
          label: s.label || s.name || `Series ${index + 1}`,
          type: s.type || chartType === 'combo' ? (index % 2 === 0 ? 'bar' : 'line') : chartType === 'bar' ? 'bar' : chartType === 'line' ? 'line' : 'area',
          yAxisId: s.yAxisId || 'left',
          color: s.color || `hsl(var(--chart-${index + 1}))`,
          stackId: s.stackId || undefined,
          // Store canonical fields for proper saving
          metric_name: s.metric_name || (isCanonical ? s.label : undefined),
          entity_name: s.entity_name || (isCanonical ? s.entity_name : undefined),
        };
      }) : [];

      // Generate Y axes from AI response or create defaults
      const enhancedYAxes = generatedConfig.yAxes ? generatedConfig.yAxes.map((axis: any, index: number) => ({
        id: axis.id || (index === 0 ? 'left' : 'right'),
        label: axis.label || (index === 0 ? 'Value' : ''),
        type: axis.type || 'linear',
        scale: axis.scale || 'auto',
        format: axis.format || 'number',
        decimals: axis.decimals || 0,
      })) : [
        {
          id: 'left',
          label: generatedConfig.yAxis || 'Value',
          type: 'linear' as 'linear' | 'log',
          scale: 'auto' as 'auto' | 'thousands' | 'lakhs' | 'millions' | 'crores',
          format: 'number' as 'number' | 'currency' | 'percentage',
          decimals: 0,
        },
        {
          id: 'right',
          label: '',
          type: 'linear' as 'linear' | 'log',
          scale: 'auto' as 'auto' | 'thousands' | 'lakhs' | 'millions' | 'crores',
          format: 'number' as 'number' | 'currency' | 'percentage',
          decimals: 0,
        },
      ];

      // Update enhanced config with comprehensive AI-generated configuration
      setEnhancedConfig({
        title: generatedConfig.title || chartTitle || '',
        xAxis: {
          key: generatedConfig.xKey || generatedConfig.xAxis || (isCanonical ? 'period' : availableColumns[0] || ''),
          label: generatedConfig.xLabel || generatedConfig.xAxis || 'X Axis',
          type: generatedConfig.xAxisType || (isCanonical ? 'time' : 'category'),
        },
        yAxes: enhancedYAxes,
        series: enhancedSeries,
        showLegend: generatedConfig.showLegend ?? true,
        showTooltip: generatedConfig.showTooltip ?? true,
        showDataLabels: generatedConfig.showDataLabels ?? false,
        showOriginalValues: generatedConfig.showOriginalValues ?? false,
      });

      // Update basic form fields
      setChartType(generatedConfig.chartType || chartType);
      setXAxis(generatedConfig.xKey || generatedConfig.xAxis || enhancedConfig.xAxis.key);
      if (enhancedYAxes.length > 0) {
        setYAxis(enhancedYAxes[0].label);
      }
      setShowLegend(generatedConfig.showLegend ?? true);
      setShowTooltip(generatedConfig.showTooltip ?? true);

      // Create compatible chart config for preview
      const chartSeries = enhancedSeries.map((series, index) => ({
        id: series.id,
        dataKey: series.dataKey,
        name: series.label,
        type: series.type,
        yAxisId: series.yAxisId,
        color: series.color,
        stackId: series.stackId,
        metric_name: series.metric_name,
        entity_name: series.entity_name,
        label: series.label,
      }));

      const config = {
        chartType: generatedConfig.chartType || chartType,
        title: generatedConfig.title || chartTitle,
        showLegend: generatedConfig.showLegend ?? true,
        showTooltip: generatedConfig.showTooltip ?? true,
        lastRefreshed: new Date().toISOString(),
        lastResult: currentData,
        xKey: enhancedConfig.xAxis.key,
        xLabel: enhancedConfig.xAxis.label,
        xAxisType: enhancedConfig.xAxis.type,
        yAxes: enhancedYAxes,
        series: chartSeries,
        xAxis: enhancedConfig.xAxis.key,
        yAxis: enhancedYAxes.find(axis => axis.id === 'left')?.label || '',
      };

      // Store the full config for preview
      setChartConfig(config);

      setShowPreview(true);
      setActiveTab('config'); // Switch to config tab to show the results

      toast({
        title: 'Chart configuration generated',
        description: `AI has created a ${generatedConfig.chartType || chartType} chart with ${enhancedSeries.length} series`,
      });
    } catch (error) {
      console.error('AI generation error:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate chart configuration',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const refreshPreview = async () => {
    setIsRefreshingPreview(true);
    try {
      // Re-execute the query to refresh the data if needed
      if (sqlQuery?.trim() && queryResult.length === 0) {
        await executeQuery();
      }

      // Generate chart config from current enhanced config state (like generateChartConfig does)
      if (queryResult.length > 0) {
        // Create compatible chart config from enhanced config
        const chartSeries = enhancedConfig.series.map((series, index) => ({
          id: series.id || `series_${index}`,
          dataKey: series.dataKey, // For ChartRenderer
          name: series.label || series.dataKey, // For ChartRenderer
          type: series.type,
          yAxisId: series.yAxisId,
          color: series.color,
          stackId: series.stackId, // For stacking
          // Canonical format fields - use configured values or fall back to dataKey/label
          metric_name: series.metric_name || (isCanonicalData ? series.dataKey : series.dataKey),
          entity_name: series.entity_name || (isCanonicalData ? series.label : undefined),
          label: series.label,
        }));

        const config = {
          // Basic properties
          chartType,
          title: enhancedConfig.title || chartTitle,
          showLegend: enhancedConfig.showLegend,
          showTooltip: enhancedConfig.showTooltip,
          showDataLabels: enhancedConfig.showDataLabels,
          showOriginalValues: enhancedConfig.showOriginalValues,
          lastRefreshed: new Date().toISOString(),
          lastResult: queryResult,

          // X Axis configuration
          xKey: enhancedConfig.xAxis.key,
          xLabel: enhancedConfig.xAxis.label,
          xAxisType: enhancedConfig.xAxis.type,

          // Y Axes configuration - convert to canonical format
          yAxes: enhancedConfig.yAxes.map(axis => ({
            id: axis.id,
            label: axis.label,
            type: axis.format === 'percentage' ? 'percentage' : 'absolute',
            format: axis.format,
            decimals: axis.decimals,
            scale: axis.scale,
          })),

          // Series configuration - use format that works for both renderers
          series: chartSeries,

          // Legacy compatibility
          xAxis: enhancedConfig.xAxis.key,
          yAxis: enhancedConfig.yAxes.find(axis => axis.id === 'left')?.label || '',
        };

        // Update chartConfig state for preview (temporary, not saved)
        setChartConfig(config);

        toast({
          title: 'Preview updated',
          description: 'Chart preview has been updated with current configuration',
        });
      } else {
        toast({
          title: 'No data available',
          description: 'Please execute a query first to see the preview',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error refreshing preview:', error);
      toast({
        title: 'Refresh failed',
        description: error instanceof Error ? error.message : 'Failed to refresh preview',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshingPreview(false);
    }
  };

  const handleSave = () => {
    if (!(chartTitle?.trim())) {
      toast({
        title: 'Missing title',
        description: 'Please enter a chart title',
        variant: 'destructive',
      });
      return;
    }

    if (!(sqlQuery?.trim())) {
      toast({
        title: 'Missing query',
        description: 'Please enter a SQL query',
        variant: 'destructive',
      });
      return;
    }

    // Create compatible chart config from enhanced config
    // Convert enhanced series to format that works for both ChartRenderer and CanonicalChartRenderer
    const chartSeries = enhancedConfig.series.map((series, index) => ({
      id: series.id || `series_${index}`,
      dataKey: series.dataKey, // For ChartRenderer
      name: series.label || series.dataKey, // For ChartRenderer
      type: series.type,
      yAxisId: series.yAxisId,
      color: series.color,
      stackId: series.stackId, // For stacking
      // Canonical format fields - use configured values or fall back to dataKey/label
      metric_name: series.metric_name || (isCanonicalData ? series.dataKey : series.dataKey),
      entity_name: series.entity_name || (isCanonicalData ? series.label : undefined),
      label: series.label,
    }));

    const config = {
      // Basic properties
      chartType,
      title: enhancedConfig.title || chartTitle,
      showLegend: enhancedConfig.showLegend,
      showTooltip: enhancedConfig.showTooltip,
      showDataLabels: enhancedConfig.showDataLabels,
      showOriginalValues: enhancedConfig.showOriginalValues,
      lastRefreshed: new Date().toISOString(),
      lastResult: queryResult,

      // X Axis configuration
      xKey: enhancedConfig.xAxis.key,
      xLabel: enhancedConfig.xAxis.label,
      xAxisType: enhancedConfig.xAxis.type,

      // Y Axes configuration - convert to canonical format
      yAxes: enhancedConfig.yAxes.map(axis => ({
        id: axis.id,
        label: axis.label,
        type: axis.format === 'percentage' ? 'percentage' : 'absolute',
        format: axis.format,
        decimals: axis.decimals,
        scale: axis.scale,
      })),

      // Series configuration - use format that works for both renderers
      series: chartSeries,

      // Legacy compatibility
      xAxis: enhancedConfig.xAxis.key,
      yAxis: enhancedConfig.yAxes.find(axis => axis.id === 'left')?.label || '',
    };

    // Update chartConfig state for preview
    setChartConfig(config);

    if (editChart) {
      // Update existing chart
      updateChart(
        {
          id: editChart.id,
          title: chartTitle,
          sql_query: sqlQuery,
          config,
        },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      // Create new chart
      addChart(
        {
          dashboard_id: dashboardId,
          title: chartTitle,
          sql_query: sqlQuery,
          chart_type: chartType,
          config,
        },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    }
  };

  const canSave = (chartTitle?.trim() || '') && (sqlQuery?.trim() || '') && (queryResult.length > 0 || chartConfig);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{editChart ? 'Edit Chart Configuration' : 'Add Chart to Dashboard'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="query">Query</TabsTrigger>
              <TabsTrigger value="config">Configuration & Preview</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto mt-4 px-1">
            <TabsContent value="query" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Chart Title</Label>
                <Input
                  id="title"
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  placeholder="Enter chart title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sql">SQL Query</Label>
                <Textarea
                  id="sql"
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM your_table WHERE ..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={executeQuery}
                  disabled={isExecuting || !(sqlQuery?.trim())}
                  className="flex items-center gap-2"
                >
                  {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Execute Query
                </Button>

                {queryResult.length > 0 && (
                  <Badge variant="secondary">
                    {queryResult.length} rows
                  </Badge>
                )}
              </div>

              {/* Raw Data JSON Display */}
              {queryResult.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Raw Data Series JSON</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[300px] overflow-auto">
                      <pre className="text-xs bg-muted p-3 rounded border font-mono whitespace-pre-wrap">
                        {JSON.stringify(queryResult, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="config" className="h-full">
              <div className="flex h-full gap-4">
                {/* Left Pane - Configuration Form (Scrollable) */}
                <div className="flex-1 space-y-4 overflow-auto pr-2">
              {/* Chart Title */}
              <div className="space-y-2">
                <Label>Chart Title</Label>
                <Input
                  value={enhancedConfig.title}
                  onChange={(e) => updateEnhancedConfig({ title: e.target.value })}
                  placeholder="Enter chart title"
                />
              </div>

              {/* Chart Type */}
              <div className="space-y-2">
                <Label>Chart Type</Label>
                <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="line">Line Chart</SelectItem>
                    <SelectItem value="area">Area Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                    <SelectItem value="combo">Combo Chart</SelectItem>
                    <SelectItem value="table">Data Table</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Available Columns Info */}
              {availableColumns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Available Columns from Query</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {availableColumns.map(col => (
                        <Badge key={col} variant="outline">{col}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* X Axis Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">X Axis Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">X Axis Column</Label>
                      <Select
                        value={enhancedConfig.xAxis.key}
                        onValueChange={(value) => updateXAxis({ key: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select X axis column" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">X Axis Label</Label>
                      <Input
                        value={enhancedConfig.xAxis.label}
                        onChange={(e) => updateXAxis({ label: e.target.value })}
                        placeholder="e.g., Time Period"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">X Axis Type</Label>
                    <Select
                      value={enhancedConfig.xAxis.type}
                      onValueChange={(value: 'category' | 'datetime') => updateXAxis({ type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="datetime">Date/Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Y Axes Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Y Axes Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {enhancedConfig.yAxes.map((axis, index) => (
                    <div key={axis.id} className="border rounded-lg p-4 space-y-4">
                      <h4 className="font-medium text-sm">{axis.id === 'left' ? 'Primary Y Axis (Left)' : 'Secondary Y Axis (Right)'}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Label</Label>
                          <Input
                            value={axis.label}
                            onChange={(e) => updateYAxis(axis.id, { label: e.target.value })}
                            placeholder="e.g., Revenue ($)"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={axis.type}
                            onValueChange={(value: 'linear' | 'log') => updateYAxis(axis.id, { type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="linear">Linear</SelectItem>
                              <SelectItem value="log">Logarithmic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Scale</Label>
                          <Select
                            value={axis.scale}
                            onValueChange={(value: any) => updateYAxis(axis.id, { scale: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="thousands">Thousands</SelectItem>
                              <SelectItem value="lakhs">Lakhs</SelectItem>
                              <SelectItem value="millions">Millions</SelectItem>
                              <SelectItem value="crores">Crores</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Format</Label>
                          <Select
                            value={axis.format}
                            onValueChange={(value: any) => updateYAxis(axis.id, { format: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="currency">Currency</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Decimal Places</Label>
                        <Input
                          type="number"
                          min="0"
                          max="4"
                          value={axis.decimals}
                          onChange={(e) => updateYAxis(axis.id, { decimals: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Series Configuration */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Series Configuration</CardTitle>
                  <Button onClick={addSeries} size="sm" variant="outline">
                    Add Series
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {enhancedConfig.series.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No series configured. Click "Add Series" to get started.
                    </div>
                  ) : (
                    enhancedConfig.series.map((series, index) => (
                      <div key={series.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">Series {index + 1}</h4>
                          <Button
                            onClick={() => removeSeries(index)}
                            size="sm"
                            variant="destructive"
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {isCanonicalData ? (
                            <>
                              <div className="space-y-2">
                                <Label className="text-xs">Metric Name</Label>
                                <Select
                                  value={series.metric_name || undefined}
                                  onValueChange={(value) => updateSeries(index, { metric_name: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select metric" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {queryResult && queryResult.length > 0 ? Array.from(new Set(queryResult.map(row => row.metric_name).filter(m => m && m.trim()))).map(metric => (
                                      <SelectItem key={metric} value={metric}>{metric}</SelectItem>
                                    )) : null}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Entity Name</Label>
                                <Select
                                  value={series.entity_name || "all"}
                                  onValueChange={(value) => updateSeries(index, { entity_name: value === "all" ? undefined : value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select entity (optional)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All entities</SelectItem>
                                    {queryResult && queryResult.length > 0 ? Array.from(new Set(queryResult.map(row => row.entity_name).filter(e => e && e.trim()))).map(entity => (
                                      <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                                    )) : null}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          ) : (
                            <div className="space-y-2">
                              <Label className="text-xs">Data Column</Label>
                              <Select
                                value={series.dataKey || undefined}
                                onValueChange={(value) => updateSeries(index, { dataKey: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select data column" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableColumns.map(col => (
                                    <SelectItem key={col} value={col}>{col}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label className="text-xs">Label</Label>
                            <Input
                              value={series.label}
                              onChange={(e) => updateSeries(index, { label: e.target.value })}
                              placeholder="Series label"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Chart Type</Label>
                            <Select
                              value={series.type}
                              onValueChange={(value: 'bar' | 'line' | 'area') => updateSeries(index, { type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bar">Bar</SelectItem>
                                <SelectItem value="line">Line</SelectItem>
                                <SelectItem value="area">Area</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Y Axis</Label>
                            <Select
                              value={series.yAxisId}
                              onValueChange={(value: 'left' | 'right') => updateSeries(index, { yAxisId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">Left (Primary)</SelectItem>
                                <SelectItem value="right">Right (Secondary)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2 text-xs">
                            <input
                              type="checkbox"
                              checked={!!series.stackId}
                              onChange={(e) => updateSeries(index, { stackId: e.target.checked ? 'stack' : undefined })}
                            />
                            <span>Stack with other bars/areas</span>
                          </label>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Color</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={series.color}
                              onChange={(e) => updateSeries(index, { color: e.target.value })}
                              className="w-16 h-8"
                            />
                            <Input
                              value={series.color}
                              onChange={(e) => updateSeries(index, { color: e.target.value })}
                              placeholder="#000000 or hsl(...)"
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Chart Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Chart Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showLegend"
                      checked={enhancedConfig.showLegend}
                      onChange={(e) => updateEnhancedConfig({ showLegend: e.target.checked })}
                    />
                    <Label htmlFor="showLegend">Show Legend</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showTooltip"
                      checked={enhancedConfig.showTooltip}
                      onChange={(e) => updateEnhancedConfig({ showTooltip: e.target.checked })}
                    />
                    <Label htmlFor="showTooltip">Show Tooltip</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showDataLabels"
                      checked={enhancedConfig.showDataLabels}
                      onChange={(e) => updateEnhancedConfig({ showDataLabels: e.target.checked })}
                    />
                    <Label htmlFor="showDataLabels">Show Data Labels</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showOriginalValues"
                      checked={enhancedConfig.showOriginalValues}
                      onChange={(e) => updateEnhancedConfig({ showOriginalValues: e.target.checked })}
                    />
                    <Label htmlFor="showOriginalValues">Show Original Values</Label>
                  </div>
                </CardContent>
              </Card>

              {/* AI Generation Button */}
              <div className="flex gap-2">
                <Button
                  onClick={generateChartConfig}
                  disabled={isGenerating || queryResult.length === 0}
                  className="flex items-center gap-2"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Generate with AI
                </Button>
              </div>
                </div>

                {/* Right Pane - Preview (Fixed) */}
                <div className="w-1/2 border-l pl-4">
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">Chart Preview</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshPreview}
                        disabled={isRefreshingPreview || !sqlQuery?.trim()}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className={`h-4 w-4 ${isRefreshingPreview ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                    
                    <div className="flex-1">
                      {chartConfig ? (
                        <div className="space-y-4">
                          <div className="text-sm text-muted-foreground">
                            {queryResult.length > 0 
                              ? `Query returned ${queryResult.length} rows`
                              : editChart 
                                ? `Showing saved chart data (${chartConfig?.lastResult?.length || 0} rows)`
                                : 'Chart configuration ready - execute query to see data'
                            }
                          </div>

                          {(queryResult.length > 0 || (chartConfig.lastResult && chartConfig.lastResult.length > 0)) ? (
                            chartConfig.series && chartConfig.yAxes ? (
                              <CanonicalChartRenderer
                                config={chartConfig}
                                data={queryResult.length > 0 ? queryResult : chartConfig.lastResult}
                              />
                            ) : (
                              <ChartRenderer
                                type={chartType}
                                data={queryResult.length > 0 ? queryResult : chartConfig.lastResult}
                                config={chartConfig}
                              />
                            )
                          ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground border-2 border-dashed border-muted-foreground/25 rounded-lg">
                              <div className="text-center">
                                <div className="text-lg font-medium mb-2">Chart Preview</div>
                                <div className="text-sm">
                                  {editChart 
                                    ? 'Execute the query to see the chart with current data'
                                    : 'Execute a query to see the chart preview'
                                  }
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-64 text-muted-foreground border-2 border-dashed border-muted-foreground/25 rounded-lg">
                          <div className="text-center">
                            <div className="text-lg font-medium mb-2">Chart Preview</div>
                            <div className="text-sm">Generate a chart configuration to see the preview</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

          </div>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || (editChart ? isUpdating : isAdding)}
            className="flex items-center gap-2"
          >
            {(editChart ? isUpdating : isAdding) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editChart ? 'Update Chart' : 'Save Chart'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};