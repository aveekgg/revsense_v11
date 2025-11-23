import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, LayoutDashboard } from 'lucide-react';
import { useDashboards } from '@/hooks/useDashboards';
import { useDashboardCharts } from '@/hooks/useDashboardCharts';
import { CreateDashboardDialog } from './CreateDashboardDialog';
import { DashboardChartItem } from './DashboardChartItem';

export const DashboardTabManager = () => {
  const { dashboards, createDashboard, isLoading: isDashboardsLoading, isCreating } = useDashboards();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeDashboard, setActiveDashboard] = useState<string>('');

  const { charts, isLoading: isChartsLoading } = useDashboardCharts(activeDashboard);

  // Set the first dashboard as active when dashboards load
  useState(() => {
    if (dashboards && dashboards.length > 0 && !activeDashboard) {
      setActiveDashboard(dashboards[0].id);
    }
  });

  const handleCreateDashboard = (data: { name: string; description?: string }) => {
    createDashboard(data);
  };

  if (isDashboardsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboards...</div>
      </div>
    );
  }

  if (!dashboards || dashboards.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <LayoutDashboard className="h-16 w-16 text-muted-foreground" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">No dashboards yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Save queries from the Feed tab to create your first dashboard, or create an empty dashboard to get started.
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Dashboard
          </Button>
        </div>
        <CreateDashboardDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={handleCreateDashboard}
          isLoading={isCreating}
        />
      </>
    );
  }

  return (
    <>
      <Tabs value={activeDashboard} onValueChange={setActiveDashboard}>
        <TabsList>
          {dashboards.map((dashboard) => (
            <TabsTrigger key={dashboard.id} value={dashboard.id}>
              {dashboard.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {dashboards.map((dashboard) => (
          <TabsContent key={dashboard.id} value={dashboard.id} className="space-y-4 mt-6">
            {dashboard.description && (
              <p className="text-sm text-muted-foreground">{dashboard.description}</p>
            )}

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
                {charts.map((chart) => (
                  <DashboardChartItem
                    key={chart.id}
                    id={chart.id}
                    title={chart.title}
                    sql={chart.sql_query}
                    chartType={chart.chart_type as any}
                    config={chart.config}
                    lastRefreshed={chart.config?.lastRefreshed}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <CreateDashboardDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateDashboard}
        isLoading={isCreating}
      />
    </>
  );
};
