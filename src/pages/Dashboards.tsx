import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, LayoutDashboard } from 'lucide-react';
import { useDashboards } from '@/hooks/useDashboards';
import { CreateDashboardDialog } from '@/components/dashboard/CreateDashboardDialog';
import { DashboardTabManager } from '@/components/dashboard/DashboardTabManager';

const Dashboards = () => {
  const { dashboards, isLoading, createDashboard, isCreating } = useDashboards();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

  const handleCreateDashboard = (data: { name: string; description?: string }) => {
    createDashboard(data);
    setShowCreateDialog(false);
  };

  if (selectedDashboardId) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b bg-card px-6 py-4">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedDashboardId(null)}
            className="mb-2"
          >
            ← Back to Dashboards
          </Button>
          <h1 className="text-2xl font-bold">
            {dashboards?.find(d => d.id === selectedDashboardId)?.name || 'Dashboard'}
          </h1>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <DashboardTabManager />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            Dashboards
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage and view all your data dashboards
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Dashboard
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : dashboards && dashboards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((dashboard) => (
            <Card 
              key={dashboard.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedDashboardId(dashboard.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                  {dashboard.name}
                </CardTitle>
                {dashboard.description && (
                  <CardDescription>{dashboard.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click to view dashboard
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
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
      )}

      <CreateDashboardDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateDashboard}
        isLoading={isCreating}
      />
    </div>
  );
};

export default Dashboards;
