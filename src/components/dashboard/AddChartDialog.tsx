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
import { Loader2, Play, Wand2, Eye, EyeOff, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import { CanonicalChartRenderer } from '@/components/charts/CanonicalChartRenderer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDashboardCharts } from '@/hooks/useDashboardCharts';
import { ChartFilter } from '@/types/dashboard';
import ChartFilters from './ChartFilters';

// Utility function to replace placeholders in SQL
const replacePlaceholders = (sql: string, filterValues: Record<string, any>): string => {
  let replacedSql = sql;
  Object.entries(filterValues).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // For IN clauses: {[hotel]} -> 'Hotel A', 'Hotel B' or NULL
      const replacement = value.length > 0 
        ? value.map(v => `'${v.replace(/'/g, "''")}'`).join(', ')
        : `NULL`;
      replacedSql = replacedSql.replace(new RegExp(`(\\{\\[${key}\\]\\}|\\{\\{${key}\\}\\})`, 'g'), replacement);
    } else if (typeof value === 'object' && value.start && value.end) {
      // For ranges: {[date_range]} -> BETWEEN 'start' AND 'end'
      const replacement = `BETWEEN '${value.start.toISOString().split('T')[0]}' AND '${value.end.toISOString().split('T')[0]}'`;
      replacedSql = replacedSql.replace(new RegExp(`(\\{\\[${key}\\]\\}|\\{\\{${key}\\}\\})`, 'g'), replacement);
    } else {
      // For text: {[param]} -> 'value' or NULL
      const replacement = value ? `'${value.replace(/'/g, "''")}'` : `NULL`;
      replacedSql = replacedSql.replace(new RegExp(`(\\{\\[${key}\\]\\}|\\{\\{${key}\\}\\})`, 'g'), replacement);
    }
  });
  return replacedSql;
};

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
        scale: 'auto' as 'auto' | 'thousands' | 'lakhs' | 'millions' | 'crores' | 'billion' | 'sci_custom',
        format: 'number' as 'number' | 'currency' | 'percentage',
        decimals: 0,
        min: undefined,
        max: undefined,
        sciExponent: undefined,
      },
      {
        id: 'right',
        label: '',
        type: 'linear' as 'linear' | 'log',
        scale: 'auto' as 'auto' | 'thousands' | 'lakhs' | 'millions' | 'crores' | 'billion' | 'sci_custom',
        format: 'number' as 'number' | 'currency' | 'percentage',
        decimals: 0,
        min: undefined,
        max: undefined,
        sciExponent: undefined,
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
      showDataLabels?: boolean;
      labelPosition?: 'top' | 'center' | 'bottom';
      strokeDasharray?: string;
    }>,
    showLegend: true,
    showTooltip: true,
    showOriginalValues: false,
  });

  // Filters state
  const [filters, setFilters] = useState<ChartFilter[]>([]);
  const [showFiltersTab, setShowFiltersTab] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

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

        // Initialize filters
        setFilters(editChart.config?.filters || []);
        setShowFiltersTab((editChart.config?.filters?.length || 0) > 0);

        // Initialize filter values from saved filter defaults
        const savedFilters = editChart.config?.filters || [];
        const initialFilterValues: Record<string, any> = {};
        savedFilters.forEach(filter => {
          initialFilterValues[filter.placeholder] = filter.defaultValue || (filter.multiple ? [] : '');
        });
        setFilterValues(initialFilterValues);

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

        // Reset filters
        setFilters([]);
        setShowFiltersTab(false);

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
              min: undefined,
              max: undefined,
              sciExponent: undefined,
            },
            {
              id: 'right',
              label: '',
              type: 'linear',
              scale: 'auto',
              format: 'number',
              decimals: 0,
              min: undefined,
              max: undefined,
              sciExponent: undefined,
            },
          ],
          series: [],
          showLegend: true,
          showTooltip: true,
          showOriginalValues: false,
        });
      }
    }
  }, [open, editChart]);

  // Update canonical data detection when query results change
  useEffect(() => {
    if (queryResult.length > 0) {
      setIsCanonicalData('metric_name' in queryResult[0] && 'entity_name' in queryResult[0] && 'metric_value' in queryResult[0]);
    } else {
      setIsCanonicalData(false);
    }
  }, [queryResult]);

  // Initialize filter values when filters change
  useEffect(() => {
    const currentPlaceholders = Object.keys(filterValues);
    const filterPlaceholders = filters.map(f => f.placeholder);

    // Remove values for filters that no longer exist
    const newValues = { ...filterValues };
    currentPlaceholders.forEach(placeholder => {
      if (!filterPlaceholders.includes(placeholder)) {
        delete newValues[placeholder];
      }
    });

    // Add defaults for new filters only if they don't already have values
    filters.forEach(filter => {
      if (!(filter.placeholder in newValues)) {
        newValues[filter.placeholder] = filter.defaultValue || (filter.multiple ? [] : '');
      }
    });

    if (JSON.stringify(newValues) !== JSON.stringify(filterValues)) {
      setFilterValues(newValues);
    }
  }, [filters.map(f => f.placeholder).join(',')]); // Only depend on filter placeholders

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
      showDataLabels: false,
      labelPosition: 'top' as 'top' | 'center' | 'bottom',
      strokeDasharray: undefined,
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

  // Filter validation helpers
  const hasPlaceholders = /\{\[\w+\]\}/.test(sqlQuery);
  const hasConfiguredFilters = filters.length > 0;
  const hasValidFilterValues = Object.keys(filterValues).length > 0 && 
    Object.values(filterValues).some(value => 
      (Array.isArray(value) && value.length > 0) || 
      (!Array.isArray(value) && value !== '' && value !== null && value !== undefined)
    );

  const executeQuery = async () => {
    if (!(sqlQuery?.trim())) {
      toast({
        title: 'Error',
        description: 'Please enter a SQL query',
        variant: 'destructive',
      });
      return;
    }

    // If there are placeholders but no configured filters, show error
    if (hasPlaceholders && !hasConfiguredFilters) {
      toast({
        title: 'Filter placeholders detected',
        description: 'Your query contains filter placeholders like {[param]}. Please configure filters in the "Filters" tab.',
        variant: 'destructive',
      });
      return;
    }

    setIsExecuting(true);
    try {
      // Apply filters to SQL
      const filteredSql = replacePlaceholders(sqlQuery, filterValues);

      const { data, error } = await supabase.rpc('execute_safe_query', {
        query_text: filteredSql,
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(String(data.error));
      }

      const resultArray = Array.isArray(data) ? data : [];
      setQueryResult(resultArray);
      toast({
        title: 'Query executed',
        description: `Found ${resultArray.length} rows${hasValidFilterValues ? ' (with filters applied)' : ''}`,
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
          showDataLabels: series.showDataLabels,
          labelPosition: series.labelPosition,
          strokeDasharray: series.strokeDasharray,
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
            min: axis.min,
            max: axis.max,
            sciExponent: axis.sciExponent,
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

    // Validate filter options - ensure no empty options
    const invalidFilters = filters.filter(filter =>
      filter.options && filter.options.some(option => !option.trim())
    );

    if (invalidFilters.length > 0) {
      toast({
        title: 'Invalid filter options',
        description: `Please fill in or remove empty options in: ${invalidFilters.map(f => f.label).join(', ')}`,
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
      showDataLabels: series.showDataLabels,
      labelPosition: series.labelPosition,
      strokeDasharray: series.strokeDasharray,
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
      showOriginalValues: enhancedConfig.showOriginalValues,
      lastRefreshed: new Date().toISOString(),
      lastResult: queryResult,

      // Filters - clean up empty options before saving
      filters: filters.length > 0 ? filters.map(filter => ({
        ...filter,
        options: filter.options?.filter(option => option.trim()) || undefined
      })).filter(filter => filter.options?.length || filter.type === 'text' || filter.type === 'range') : undefined,

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
        min: axis.min,
        max: axis.max,
        sciExponent: axis.sciExponent,
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
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
              <TabsTrigger value="query">Query</TabsTrigger>
              <TabsTrigger value="filters">Filters</TabsTrigger>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="sql">SQL Query</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isParameterized"
                      checked={hasPlaceholders}
                      disabled={true}
                      className="rounded"
                    />
                    <Label htmlFor="isParameterized" className="text-sm text-muted-foreground">
                      Parameterized Query
                    </Label>
                  </div>
                </div>
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
                  Execute Query{hasValidFilterValues ? ' (with filters)' : ''}
                </Button>

                {queryResult.length > 0 && (
                  <Badge variant="secondary">
                    {queryResult.length} rows
                  </Badge>
                )}
              </div>

              {/* Filter warning */}
              {hasPlaceholders && hasConfiguredFilters && !hasValidFilterValues && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Filter Required:</strong> Your query contains filter placeholders like <code className="bg-yellow-100 px-1 rounded">{`{[hotel]}`}</code>.
                    Go to the <strong>"Filters"</strong> tab to configure and test your filters before executing the query.
                  </p>
                </div>
              )}

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

            <TabsContent value="filters" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Chart Filters</Label>
                  <Button
                    onClick={() => setFilters([...filters, {
                      type: 'select',
                      label: '',
                      placeholder: '',
                      options: [],
                      multiple: false
                    }])}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Filter
                  </Button>
                </div>

                {filters.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No filters configured. Add filters to make charts dynamic.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filters.map((filter, index) => (
                      <Card key={index}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Filter {index + 1}</CardTitle>
                            <Button
                              onClick={() => setFilters(filters.filter((_, i) => i !== index))}
                              size="sm"
                              variant="destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Filter Type</Label>
                              <Select
                                value={filter.type}
                                onValueChange={(value: ChartFilter['type']) => {
                                  const updatedFilters = [...filters];
                                  updatedFilters[index] = { ...filter, type: value };
                                  setFilters(updatedFilters);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                                  <SelectItem value="preset_range">Preset Range</SelectItem>
                                  <SelectItem value="range">Date Range Picker</SelectItem>
                                  <SelectItem value="text">Text Input</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Label</Label>
                              <Input
                                value={filter.label}
                                onChange={(e) => {
                                  const updatedFilters = [...filters];
                                  updatedFilters[index] = { ...filter, label: e.target.value };
                                  setFilters(updatedFilters);
                                }}
                                placeholder="e.g., Select Hotels"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>SQL Placeholder</Label>
                            <Input
                              value={filter.placeholder}
                              onChange={(e) => {
                                const updatedFilters = [...filters];
                                updatedFilters[index] = { ...filter, placeholder: e.target.value };
                                setFilters(updatedFilters);
                              }}
                              placeholder="e.g., hotel"
                            />
                            <p className="text-xs text-muted-foreground">
                              Use {'{['}{filter.placeholder}{']}'} in your SQL WHERE clause (e.g., WHERE column IN {'{['}{filter.placeholder}{']}'} for multi-select)
                            </p>
                          </div>

                          {(filter.type === 'select' || filter.type === 'preset_range') && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Options</Label>
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const updatedFilters = [...filters];
                                    const currentOptions = filter.options || [];
                                    updatedFilters[index] = {
                                      ...filter,
                                      options: [...currentOptions, '']
                                    };
                                    setFilters(updatedFilters);
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Option
                                </Button>
                              </div>

                              <div className="space-y-2">
                                {filter.options && filter.options.length > 0 ? (
                                  filter.options.map((option, optionIndex) => (
                                    <div key={optionIndex} className="flex items-center gap-2">
                                      <Input
                                        value={option}
                                        onChange={(e) => {
                                          const updatedFilters = [...filters];
                                          const newOptions = [...filter.options!];
                                          newOptions[optionIndex] = e.target.value;
                                          updatedFilters[index] = {
                                            ...filter,
                                            options: newOptions
                                          };
                                          setFilters(updatedFilters);
                                        }}
                                        placeholder={`Option ${optionIndex + 1}`}
                                        className="flex-1"
                                      />
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          const updatedFilters = [...filters];
                                          const newOptions = filter.options!.filter((_, i) => i !== optionIndex);
                                          updatedFilters[index] = {
                                            ...filter,
                                            options: newOptions.length > 0 ? newOptions : undefined
                                          };
                                          setFilters(updatedFilters);
                                        }}
                                        size="sm"
                                        variant="destructive"
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">
                                    No options added yet. Click "Add Option" to get started.
                                  </p>
                                )}
                              </div>

                              {filter.options && filter.options.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {filter.options.filter(opt => opt.trim()).length} valid options configured
                                  {filter.options.some(opt => !opt.trim()) && (
                                    <span className="text-orange-600 ml-1">
                                      ({filter.options.filter(opt => !opt.trim()).length} empty)
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          )}

                          {filter.type === 'select' && (
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`multiple-${index}`}
                                checked={filter.multiple || false}
                                onChange={(e) => {
                                  const updatedFilters = [...filters];
                                  updatedFilters[index] = { ...filter, multiple: e.target.checked };
                                  setFilters(updatedFilters);
                                }}
                              />
                              <Label htmlFor={`multiple-${index}`}>Allow multiple selections</Label>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Default Value (optional)</Label>
                            {filter.type === 'select' && (
                              <Select
                                value={Array.isArray(filter.defaultValue) ? filter.defaultValue.join(', ') : filter.defaultValue || ''}
                                onValueChange={(value) => {
                                  const updatedFilters = [...filters];
                                  updatedFilters[index] = {
                                    ...filter,
                                    defaultValue: filter.multiple ? value.split(', ').filter(v => v) : value || undefined
                                  };
                                  setFilters(updatedFilters);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select default value(s)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {filter.options?.filter(option => option.trim()).map(option => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {filter.type === 'preset_range' && (
                              <Select
                                value={filter.defaultValue || ''}
                                onValueChange={(value) => {
                                  const updatedFilters = [...filters];
                                  updatedFilters[index] = { ...filter, defaultValue: value };
                                  setFilters(updatedFilters);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select default preset" />
                                </SelectTrigger>
                                <SelectContent>
                                  {filter.options?.filter(option => option.trim()).map(option => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {filter.type === 'text' && (
                              <Input
                                value={filter.defaultValue || ''}
                                onChange={(e) => {
                                  const updatedFilters = [...filters];
                                  updatedFilters[index] = { ...filter, defaultValue: e.target.value };
                                  setFilters(updatedFilters);
                                }}
                                placeholder="Enter default text"
                              />
                            )}

                            {filter.type === 'range' && (
                              <Input
                                value={filter.defaultValue ? `${filter.defaultValue.start} to ${filter.defaultValue.end}` : ''}
                                onChange={(e) => {
                                  const [start, end] = e.target.value.split(' to ');
                                  const updatedFilters = [...filters];
                                  updatedFilters[index] = {
                                    ...filter,
                                    defaultValue: start && end ? { start, end } : undefined
                                  };
                                  setFilters(updatedFilters);
                                }}
                                placeholder="YYYY-MM-DD to YYYY-MM-DD"
                              />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Test Filters Section */}
                {filters.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Test Filters</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Set filter values below and execute query to test with filters applied
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ChartFilters
                        filters={filters}
                        onFiltersChange={setFilterValues}
                        initialValues={filterValues}
                      />

                      {/* Show filtered SQL preview */}
                      {sqlQuery?.trim() && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <Label className="text-sm font-medium mb-2 block">SQL Query Preview</Label>
                          <div className="text-xs font-mono bg-background p-2 rounded border max-h-32 overflow-auto">
                            {replacePlaceholders(sqlQuery, filterValues)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Showing SQL with current filter values applied
                          </p>
                        </div>
                      )}

                      <div className="mt-4">
                        <Button
                          onClick={executeQuery}
                          disabled={isExecuting || !(sqlQuery?.trim())}
                          className="flex items-center gap-2"
                        >
                          {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          Execute Query
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
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
                              <SelectItem value="thousands">Thousands (K)</SelectItem>
                              <SelectItem value="lakhs">Lakhs (L)</SelectItem>
                              <SelectItem value="millions">Millions (M)</SelectItem>
                              <SelectItem value="crores">Crores (Cr)</SelectItem>
                              <SelectItem value="billion">Billions (B)</SelectItem>
                              <SelectItem value="sci_custom">Custom 10ⁿ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {axis.scale === 'sci_custom' && (
                          <div className="space-y-2">
                            <Label className="text-xs">Exponent (n)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="15"
                              value={axis.sciExponent || ''}
                              onChange={(e) => updateYAxis(axis.id, { sciExponent: parseInt(e.target.value) || 0 })}
                              placeholder="e.g., 6 for 10⁶"
                            />
                          </div>
                        )}
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Min Value (optional)</Label>
                          <Input
                            type="number"
                            placeholder="Auto"
                            value={axis.min ?? ''}
                            onChange={(e) => updateYAxis(axis.id, { min: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Max Value (optional)</Label>
                          <Input
                            type="number"
                            placeholder="Auto"
                            value={axis.max ?? ''}
                            onChange={(e) => updateYAxis(axis.id, { max: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                          />
                        </div>
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
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2 text-xs">
                            <input
                              type="checkbox"
                              checked={series.showDataLabels ?? false}
                              onChange={(e) => updateSeries(index, { showDataLabels: e.target.checked })}
                            />
                            <span>Show Data Labels</span>
                          </label>
                        </div>
                        {series.showDataLabels && (
                          <div className="space-y-2">
                            <Label className="text-xs">Label Position</Label>
                            <Select
                              value={series.labelPosition || 'top'}
                              onValueChange={(value: 'top' | 'center' | 'bottom') => updateSeries(index, { labelPosition: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="top">Top</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="bottom">Bottom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {series.type === 'line' && (
                          <div className="space-y-2">
                            <Label className="text-xs">Line Style</Label>
                            <Select
                              value={series.strokeDasharray || 'solid'}
                              onValueChange={(value) => updateSeries(index, { strokeDasharray: value === 'solid' ? undefined : value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="solid">Solid</SelectItem>
                                <SelectItem value="5 5">Dashed</SelectItem>
                                <SelectItem value="10 5">Long Dash</SelectItem>
                                <SelectItem value="2 2">Dotted</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
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
                            (() => {
                              const displayData = queryResult.length > 0 ? queryResult : chartConfig.lastResult;
                              const isDataCanonical = displayData && displayData.length > 0 && 
                                'metric_name' in displayData[0] && 'entity_name' in displayData[0] && 'metric_value' in displayData[0];
                              
                              return isDataCanonical && chartConfig.series && chartConfig.yAxes ? (
                                <CanonicalChartRenderer
                                  config={chartConfig}
                                  data={displayData}
                                />
                              ) : (
                                <ChartRenderer
                                  type={chartConfig.chartType || 'bar'}
                                  data={displayData}
                                  config={chartConfig}
                                />
                              );
                            })()
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