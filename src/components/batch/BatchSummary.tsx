import { CheckCircle2, XCircle, Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { BatchFile } from "@/hooks/useBatchProcessor";

interface BatchSummaryProps {
  stats: {
    total: number;
    completed: number;
    failed: number;
    totalRecordsCreated: number;
  };
  files: BatchFile[];
}

export const BatchSummary = ({ stats, files }: BatchSummaryProps) => {
  const navigate = useNavigate();

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          Batch Processing Complete
        </CardTitle>
        <CardDescription>Summary of the batch processing operation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Files</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-success">{stats.completed}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Records Created</p>
            <p className="text-2xl font-bold text-primary">{stats.totalRecordsCreated}</p>
          </div>
        </div>

        {stats.failed > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-foreground mb-2">Failed Files:</p>
            <ul className="space-y-1">
              {files
                .filter(f => f.status === 'error')
                .map(f => (
                  <li key={f.id} className="text-sm text-muted-foreground flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">{f.file.name}:</span> {f.error}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="pt-4 border-t flex justify-end">
          <Button
            onClick={() => navigate('/dashboard/consolidated-data')}
            className="gap-2"
          >
            <Database className="h-4 w-4" />
            View Consolidated Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
