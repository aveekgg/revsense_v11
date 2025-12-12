import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboards } from '@/hooks/useDashboards';
import { useDashboardCharts } from '@/hooks/useDashboardCharts';

interface DuplicateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartId: string;
  currentDashboardId: string;
  currentChartTitle: string;
  onDuplicate?: () => void;
}

export const DuplicateChartDialog = ({
  open,
  onOpenChange,
  chartId,
  currentDashboardId,
  currentChartTitle,
  onDuplicate,
}: DuplicateChartDialogProps) => {
  const { dashboards } = useDashboards();
  const { duplicateChart, isDuplicating } = useDashboardCharts();
  const [targetDashboardId, setTargetDashboardId] = useState(currentDashboardId);
  const [newTitle, setNewTitle] = useState(`${currentChartTitle} (Copy)`);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTargetDashboardId(currentDashboardId);
      setNewTitle(`${currentChartTitle} (Copy)`);
    }
  }, [open, currentDashboardId, currentChartTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDashboardId || !newTitle.trim()) return;

    duplicateChart(
      {
        chartId,
        targetDashboardId,
        newTitle: newTitle.trim(),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onDuplicate?.();
        },
      }
    );
  };

  // Filter out current dashboard from options, but allow duplicating to same dashboard
  const availableDashboards = dashboards || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate Chart</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="target-dashboard">Target Dashboard *</Label>
              <Select value={targetDashboardId} onValueChange={setTargetDashboardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {availableDashboards.map((dashboard) => (
                    <SelectItem key={dashboard.id} value={dashboard.id}>
                      {dashboard.name}
                      {dashboard.id === currentDashboardId && ' (Current)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-title">New Chart Title *</Label>
              <Input
                id="new-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter a title for the duplicated chart"
                required
              />
            </div>
            <div className="text-sm text-muted-foreground">
              This will create a copy of the chart with the same SQL query, configuration, and data.
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!targetDashboardId || !newTitle.trim() || isDuplicating}>
              {isDuplicating ? 'Duplicating...' : 'Duplicate Chart'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};