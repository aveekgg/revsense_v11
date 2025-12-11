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
import { Loader2, Play, Wand2, Eye, EyeOff } from 'lucide-react';
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
  const [isExecuting, setIsExecuting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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
        },
      });

      if (response.error) throw response.error;

      const { config: generatedConfig, data: processedData } = response.data;
      
      // Update form fields with AI-generated config
      setChartType(generatedConfig.chartType);
      setXAxis(generatedConfig.xLabel || generatedConfig.xKey);
      if (generatedConfig.yAxes && generatedConfig.yAxes.length > 0) {
        setYAxis(generatedConfig.yAxes[0].label || '');
      }
      setShowLegend(generatedConfig.showLegend ?? true);
      setShowTooltip(generatedConfig.showTooltip ?? true);
      
      // Store the full config
      setChartConfig(generatedConfig);
      
      // Update data if AI processed it differently
      if (processedData && processedData.length > 0) {
        setQueryResult(processedData);
        setIsCanonicalData(processedData.length > 0 && 'metric_name' in processedData[0] && 'entity_name' in processedData[0] && 'metric_value' in processedData[0]);
      }

      // Update enhanced config with AI results
      setEnhancedConfig({
        title: generatedConfig.title || chartTitle || '',
        xAxis: {
          key: generatedConfig.xKey || generatedConfig.xAxis || '',
          label: generatedConfig.xLabel || '',
          type: generatedConfig.xAxisType || 'category',
        },
        yAxes: generatedConfig.yAxes || [
          {
            id: 'left',
            label: generatedConfig.yAxis || '',
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
        series: generatedConfig.series ? generatedConfig.series.map((s: any, index: number) => ({
          id: s.id || `series_${index}`,
          dataKey: processedData && processedData.length > 0 && 'metric_name' in processedData[0] ? 'metric_value' : (s.dataKey || s.metric_name || 'metric_value'),
          label: s.label || `Series ${index + 1}`,
          type: s.type || 'bar',
          yAxisId: s.yAxisId || 'left',
          color: s.color || `hsl(var(--chart-${index + 1}))`,
          // Store canonical fields for proper saving
          metric_name: s.metric_name,
          entity_name: s.entity_name,
        })) : [],
        showLegend: generatedConfig.showLegend ?? true,
        showTooltip: generatedConfig.showTooltip ?? true,
      });
      
      setShowPreview(true);
      setActiveTab('config'); // Switch to config tab to show the results

      toast({
        title: 'Chart generated',
        description: 'AI has generated the chart configuration and populated the form fields',
      });
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate chart',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
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
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="query">Query</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="save">Save</TabsTrigger>
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
            </TabsContent>

            <TabsContent value="config" className="space-y-4 overflow-auto">
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
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
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
                <div className="text-center py-8 text-muted-foreground">
                  Generate a chart configuration to see the preview
                </div>
              )}
            </TabsContent>

            <TabsContent value="save" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg space-y-2">
                  <h4 className="font-medium">Chart Summary</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Title:</strong> {chartTitle || 'Not set'}</div>
                    <div><strong>Type:</strong> {chartType}</div>
                    <div><strong>Data:</strong> {queryResult.length} rows</div>
                    <div><strong>Query:</strong> {sqlQuery ? 'Set' : 'Not set'}</div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Click "Save Chart" to add this chart to your dashboard. You can refresh it anytime to update with new data.
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