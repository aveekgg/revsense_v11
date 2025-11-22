import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboards } from '@/hooks/useDashboards';

interface SaveToDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dashboardId: string, title: string) => void;
  defaultTitle?: string;
  isLoading?: boolean;
}

export const SaveToDashboardDialog = ({
  open,
  onOpenChange,
  onSave,
  defaultTitle,
  isLoading,
}: SaveToDashboardDialogProps) => {
  const { dashboards, createDashboard, isCreating } = useDashboards();
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>('');
  const [title, setTitle] = useState(defaultTitle || '');
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');

  const handleSave = () => {
    if (showNewDashboard) {
      if (!newDashboardName.trim()) return;
      
      createDashboard(
        { name: newDashboardName.trim() },
        {
          onSuccess: (newDashboard) => {
            onSave(newDashboard.id, title || defaultTitle || 'Untitled');
            resetForm();
          },
        }
      );
    } else {
      if (!selectedDashboardId) return;
      onSave(selectedDashboardId, title || defaultTitle || 'Untitled');
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedDashboardId('');
    setTitle(defaultTitle || '');
    setShowNewDashboard(false);
    setNewDashboardName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to Dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Chart Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this chart"
            />
          </div>

          {!showNewDashboard ? (
            <div className="space-y-2">
              <Label>Select Dashboard</Label>
              <Select value={selectedDashboardId} onValueChange={setSelectedDashboardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {dashboards?.map((dashboard) => (
                    <SelectItem key={dashboard.id} value={dashboard.id}>
                      {dashboard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={() => setShowNewDashboard(true)}
              >
                + Create New Dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="newDashboard">New Dashboard Name</Label>
              <Input
                id="newDashboard"
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="e.g., Sales Dashboard"
              />
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={() => setShowNewDashboard(false)}
              >
                ← Back to existing dashboards
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => resetForm()}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isLoading ||
              isCreating ||
              (!showNewDashboard && !selectedDashboardId) ||
              (showNewDashboard && !newDashboardName.trim())
            }
          >
            {isLoading || isCreating ? 'Saving...' : 'Save to Dashboard'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
