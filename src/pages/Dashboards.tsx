import { useState, useEffect } from 'react';
import SecondaryTabs from "@/components/layout/SecondaryTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, LayoutDashboard, Trash2, Settings } from 'lucide-react';
import { useDashboards } from '@/hooks/useDashboards';
import { useDashboardCharts } from '@/hooks/useDashboardCharts';
import { CreateDashboardDialog } from '@/components/dashboard/CreateDashboardDialog';
import { DashboardChartItem } from '@/components/dashboard/DashboardChartItem';
import { AddChartDialog } from '@/components/dashboard/AddChartDialog';

const Dashboards = () => {
  const { dashboards, isLoading, createDashboard, deleteDashboard, isCreating, isDeleting } = useDashboards();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddChartDialog, setShowAddChartDialog] = useState(false);
  const [editingChart, setEditingChart] = useState<any>(null);
  const [activeDashboard, setActiveDashboard] = useState<string>('');

  const { charts, isLoading: isChartsLoading, reorderCharts } = useDashboardCharts(activeDashboard);

  // Set the first dashboard as active when dashboards load
  useEffect(() => {
    if (dashboards && dashboards.length > 0 && !activeDashboard) {
      setActiveDashboard(dashboards[0].id);
    }
  }, [dashboards, activeDashboard]);

  const handleCreateDashboard = (data: { name: string; description?: string }) => {
    createDashboard(data);
    setShowCreateDialog(false);
  };

  const handleMoveChart = (chartId: string, direction: 'up' | 'down') => {
    if (!charts) return;

    const currentIndex = charts.findIndex(c => c.id === chartId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= charts.length) return;

    // Create new positions for the affected charts
    const chartUpdates = [
      { id: charts[currentIndex].id, position: charts[newIndex].position },
      { id: charts[newIndex].id, position: charts[currentIndex].position },
    ];

    reorderCharts(chartUpdates);
  };

  const handleEditChartConfig = (chart: any) => {
    setEditingChart(chart);
    setShowAddChartDialog(true);
  };

  const handleDeleteDashboard = () => {
    if (!currentDashboard) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${currentDashboard.name}"? This action cannot be undone.`
    );
    
    if (confirmDelete) {
      deleteDashboard(currentDashboard.id);
      
      // Switch to another dashboard if available
      if (dashboards && dashboards.length > 1) {
        const remainingDashboards = dashboards.filter(d => d.id !== currentDashboard.id);
        if (remainingDashboards.length > 0) {
          setActiveDashboard(remainingDashboards[0].id);
        }
      } else {
        setActiveDashboard('');
      }
    }
  };

  // If no dashboards exist, show empty state without tabs
  if (!isLoading && (!dashboards || dashboards.length === 0)) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <LayoutDashboard className="h-7 w-7 text-primary" />
                Dashboards
              </h2>
              <p className="text-muted-foreground">
                Create and manage your data dashboards
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Dashboard
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-6">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <LayoutDashboard className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No dashboards yet</h3>
              <p className="text-muted-foreground mb-4 text-center max-w-sm">
                Create your first dashboard to start organizing your data visualizations
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        <CreateDashboardDialog 
          open={showCreateDialog} 
          onOpenChange={setShowCreateDialog}
          onSubmit={handleCreateDashboard}
          isLoading={isCreating}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b bg-card px-6 py-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-7 w-7 text-primary" />
            Dashboards
          </h2>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading dashboards...</div>
          </div>
        </div>
      </div>
    );
  }

  // Create tabs array with dashboard names plus a create button
  const tabNames = dashboards?.map(d => d.name) || [];
  const currentDashboard = dashboards?.find(d => d.id === activeDashboard);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <LayoutDashboard className="h-7 w-7 text-primary" />
              Dashboards
            </h2>
            <p className="text-muted-foreground">
              Manage and view your data dashboards
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Dashboard
            </Button>
            {currentDashboard && (
              <Button
                variant="outline"
                onClick={() => setShowAddChartDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Chart
              </Button>
            )}
          </div>
        </div>
        
        <SecondaryTabs 
          tabs={tabNames} 
          activeTab={currentDashboard?.name || ''} 
          onTabChange={(tabName) => {
            const dashboard = dashboards?.find(d => d.name === tabName);
            if (dashboard) {
              setActiveDashboard(dashboard.id);
            }
          }} 
        />
      </div>
      
      <div className="flex-1 overflow-auto p-6">
        {currentDashboard && (
          <div className="space-y-6 animate-fade-in">
            {/* Dashboard Actions Header */}
            <div className="flex items-center justify-between">
              <div>
                {currentDashboard.description && (
                  <p className="text-sm text-muted-foreground">{currentDashboard.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteDashboard}
                  disabled={isDeleting}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {isDeleting ? 'Deleting...' : 'Delete Dashboard'}
                </Button>
              </div>
            </div>

            {isChartsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading charts...</div>
            ) : !charts || charts.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-muted-foreground">No charts in this dashboard yet</p>
                <p className="text-sm text-muted-foreground">
                  Go to the Feed tab and save queries to add them here
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {charts.map((chart, index) => (
                  <DashboardChartItem
                    key={chart.id}
                    id={chart.id}
                    title={chart.title}
                    sql={chart.sql_query}
                    chartType={chart.chart_type as any}
                    config={chart.config}
                    lastRefreshed={chart.config?.lastRefreshed}
                    onMoveUp={() => handleMoveChart(chart.id, 'up')}
                    onMoveDown={() => handleMoveChart(chart.id, 'down')}
                    canMoveUp={index > 0}
                    canMoveDown={index < charts.length - 1}
                    onEditChartConfig={() => handleEditChartConfig(chart)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CreateDashboardDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateDashboard}
        isLoading={isCreating}
      />

      <AddChartDialog
        open={showAddChartDialog}
        onOpenChange={(open) => {
          setShowAddChartDialog(open);
          if (!open) setEditingChart(null);
        }}
        dashboardId={activeDashboard}
        editChart={editingChart}
      />
    </div>
  );
};

export default Dashboards;
