import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { BatchFile } from "@/hooks/useBatchProcessor";
import { cn } from "@/lib/utils";

interface FileQueueProps {
  files: BatchFile[];
}

export const FileQueue = ({ files }: FileQueueProps) => {
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {files.map((file) => (
        <div
          key={file.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 transition-colors",
            file.status === 'completed' && "bg-success/5 border-success/20",
            file.status === 'error' && "bg-destructive/5 border-destructive/20",
            file.status === 'processing' && "bg-primary/5 border-primary/20",
            file.status === 'queued' && "bg-muted/30"
          )}
        >
          <div className="flex-shrink-0 mt-0.5">
            {file.status === 'queued' && (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            {file.status === 'processing' && (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            )}
            {file.status === 'completed' && (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
            {file.status === 'error' && (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="font-medium text-sm text-foreground truncate">
                {file.file.name}
              </p>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {(file.file.size / 1024).toFixed(1)} KB
              </span>
            </div>

            <div className="mt-1">
              {file.status === 'queued' && (
                <p className="text-xs text-muted-foreground">Queued</p>
              )}
              {file.status === 'processing' && (
                <p className="text-xs text-primary">Processing...</p>
              )}
              {file.status === 'completed' && (
                <p className="text-xs text-success">
                  Completed ({file.extractedFields} fields extracted)
                </p>
              )}
              {file.status === 'error' && (
                <p className="text-xs text-destructive">{file.error}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
