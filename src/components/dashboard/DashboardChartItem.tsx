import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { SQLViewer } from '@/components/query-results/SQLViewer';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import { CanonicalChartRenderer, ChartConfig, CanonicalRow } from '@/components/charts/CanonicalChartRenderer';
import { RefreshCw, Edit, Trash2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDashboardCharts } from '@/hooks/useDashboardCharts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface DashboardChartItemProps {
  id: string;
  title: string;
  sql: string;
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'combo' | 'table';
  config: any;
  lastRefreshed?: string;
}

export const DashboardChartItem = ({
  id,
  title: initialTitle,
  sql,
  chartType,
  config,
  lastRefreshed,
}: DashboardChartItemProps) => {
  const [activeTab, setActiveTab] = useState('chart');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(initialTitle);
  const [showSQL, setShowSQL] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [refreshedData, setRefreshedData] = useState(config?.lastResult);

  const { refreshChart, updateChart, deleteChart, isRefreshing, isUpdating, isDeleting } = useDashboardCharts();

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

  const displayData = refreshedData || config?.lastResult || [];
  const hasData = displayData && displayData.length > 0;

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
                title="Edit title"
              >
                <Edit className="h-4 w-4" />
              </Button>
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chart">
                  {chartType === 'table' ? 'Table View' : 'Chart View'}
                </TabsTrigger>
                <TabsTrigger value="table">Data Table</TabsTrigger>
              </TabsList>

              <TabsContent value="chart" className="mt-4">
                {config && typeof config === 'object' && 'chartType' in config && 'series' in config && Array.isArray(displayData) && displayData.length > 0 && 'metric_name' in displayData[0] ? (
                  <CanonicalChartRenderer 
                    config={config as ChartConfig}
                    data={displayData as CanonicalRow[]}
                  />
                ) : (
                  <ChartRenderer type={chartType} data={displayData} config={config} />
                )}
              </TabsContent>

              <TabsContent value="table" className="mt-4">
                <ChartRenderer type="table" data={displayData} />
              </TabsContent>
            </Tabs>
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
