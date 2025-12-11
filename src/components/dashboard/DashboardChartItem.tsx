import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SQLViewer } from '@/components/query-results/SQLViewer';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import { CanonicalChartRenderer, ChartConfig, CanonicalRow } from '@/components/charts/CanonicalChartRenderer';
import { CanonicalDataTable } from '@/components/query-results/CanonicalDataTable';
import { RefreshCw, Edit, Trash2, Clock, ChevronDown, ChevronUp, Settings, BarChart3, Table } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDashboardCharts } from '@/hooks/useDashboardCharts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { detectDataStructure, pivotData } from '@/lib/dataPivoting';
import { EnhancedDataTable } from '@/components/query-results/EnhancedDataTable';

interface DashboardChartItemProps {
  id: string;
  title: string;
  sql: string;
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'combo' | 'table';
  config: any;
  lastRefreshed?: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onEditChartConfig?: () => void;
}

export const DashboardChartItem = ({
  id,
  title: initialTitle,
  sql,
  chartType,
  config,
  lastRefreshed,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  onEditChartConfig,
}: DashboardChartItemProps) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart'); // Default to chart view
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(initialTitle);
  const [showSQL, setShowSQL] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [refreshedData, setRefreshedData] = useState(config?.lastResult);

  const { refreshChart, updateChart, deleteChart, isRefreshing, isUpdating, isDeleting } = useDashboardCharts();

  // Use refreshed data if available, otherwise fallback to config data
  const displayData = refreshedData || config?.lastResult || [];
  const hasData = Array.isArray(displayData) && displayData.length > 0;

  // Check if data is in canonical format (same logic as ChatMessage)
  const isCanonicalFormat = hasData && displayData.length > 0 && 
    'period' in displayData[0] && 
    'metric_name' in displayData[0] && 
    'entity_name' in displayData[0];

  // Calculate column count for canonical data and set smart default (same logic as ChatMessage)
  const pivotedColumnCount = useMemo(() => {
    if (!isCanonicalFormat || !displayData || displayData.length === 0) return 0;
    
    const entities = new Set(displayData.map((r: CanonicalRow) => r.entity_name));
    const metrics = new Set(displayData.map((r: CanonicalRow) => r.metric_name));
    return entities.size * metrics.size + 1; // +1 for Period column
  }, [isCanonicalFormat, displayData]);

  // Smart default: long form if more than 6 columns, pivot otherwise (same logic as ChatMessage)
  const defaultTableView = pivotedColumnCount > 6 ? 'long' : 'pivot';

  // Update tableFormat state to use smart default for canonical data
  const [tableFormat, setTableFormat] = useState<'pivot' | 'long'>('pivot');

  // Update table format when data changes (same logic as ChatMessage)
  useEffect(() => {
    if (isCanonicalFormat) {
      setTableFormat(defaultTableView);
    }
  }, [isCanonicalFormat, defaultTableView]);

  const handleRefresh = () => {
    refreshChart(
      { id, sql_query: sql },
      {
        onSuccess: (data) => {
          setRefreshedData(data);
        },
      }
    );
  };

  const handleSaveTitle = () => {
    if (editedTitle.trim() && editedTitle !== initialTitle) {
      updateChart({ id, title: editedTitle.trim() });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteChart(id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') {
                        setEditedTitle(initialTitle);
                        setIsEditing(false);
                      }
                    }}
                    autoFocus
                    className="h-8"
                  />
                </div>
              ) : (
                <CardTitle className="text-lg truncate">{initialTitle}</CardTitle>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* View Mode Toggle Buttons */}
              <Button
                variant={viewMode === 'chart' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('chart')}
                title="Chart view"
                className="h-8 w-8 p-0"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                title="Table view"
                className="h-8 w-8 p-0"
              >
                <Table className="h-4 w-4" />
              </Button>

              {/* Table Format Toggle - Only show in table view */}
              {viewMode === 'table' && (
                <div className="flex items-center gap-1 ml-2 border-l pl-2">
                  <Button
                    variant={tableFormat === 'pivot' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setTableFormat('pivot')}
                    className="h-6 px-2 text-xs"
                  >
                    Pivot
                  </Button>
                  <Button
                    variant={tableFormat === 'long' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setTableFormat('long')}
                    className="h-6 px-2 text-xs"
                  >
                    Long
                  </Button>
                </div>
              )}

              {canMoveUp && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMoveUp}
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
              {canMoveDown && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMoveDown}
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                disabled={isUpdating}
                title="Edit chart title"
              >
                <Edit className="h-4 w-4" />
              </Button>
              {onEditChartConfig && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEditChartConfig}
                  title="Edit chart configuration (SQL, type, axes, etc.)"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
                title="Delete chart"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {(lastRefreshed || config?.lastRefreshed) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last updated: {new Date(lastRefreshed || config.lastRefreshed).toLocaleString()}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {hasData ? (
            <div>
              {viewMode === 'chart' ? (
                // Chart View
                config && typeof config === 'object' && 'chartType' in config && 'series' in config && Array.isArray(displayData) && displayData.length > 0 && 'metric_name' in displayData[0] ? (
                  <CanonicalChartRenderer
                    config={config as ChartConfig}
                    data={displayData as CanonicalRow[]}
                  />
                ) : (
                  <ChartRenderer type={chartType} data={displayData} config={config} />
                )
              ) : (
                // Table View
                <div>
                  {isCanonicalFormat ? (
                    // Use CanonicalDataTable for canonical format data (same as ChatMessage)
                    <CanonicalDataTable data={displayData as CanonicalRow[]} viewMode={tableFormat} />
                  ) : (
                    // Use original pivot logic for non-canonical data
                    <>
                      {tableFormat === 'pivot' ? (
                        // Pivot Table
                        (() => {
                          const pivotResult = detectDataStructure(displayData);
                          if (pivotResult.isNonPivoted && pivotResult.entityColumn && pivotResult.categoryColumn) {
                            const pivotedData = pivotData(
                              displayData,
                              pivotResult.entityColumn,
                              pivotResult.categoryColumn,
                              pivotResult.metricColumns || []
                            );
                            return <EnhancedDataTable data={pivotedData} maxHeight={400} />;
                          } else {
                            // Fallback to regular table if data isn't suitable for pivoting
                            return <EnhancedDataTable data={displayData} maxHeight={400} />;
                          }
                        })()
                      ) : (
                        // Long Table
                        <EnhancedDataTable data={displayData} maxHeight={400} />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No data available. Click refresh to load data.
            </div>
          )}

          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSQL(!showSQL)}
              className="w-full justify-between"
            >
              <span className="text-sm">View SQL Query</span>
              {showSQL ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {showSQL && (
              <div className="mt-2">
                <SQLViewer sql={sql} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chart</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{initialTitle}" from this dashboard? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
