import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PivotedCanonicalTableProps {
  data: any[];
  maxHeight?: number;
  defaultPageSize?: number;
}

export const PivotedCanonicalTable = ({ 
  data, 
  maxHeight = 600,
  defaultPageSize = 10 
}: PivotedCanonicalTableProps) => {
  const [pageSize, setPageSize] = useState(defaultPageSize);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No data to display
      </div>
    );
  }

  // Extract columns and group by entity
  const allColumns = Object.keys(data[0] || {});
  
  // Remove internal columns and get the Period column
  const periodColumn = 'Period';
  const metricColumns = allColumns.filter(col => 
    col !== 'Period' && !col.startsWith('_')
  );

  // Group columns by entity (assuming format "Entity - Metric")
  interface EntityGroup {
    entity: string;
    metrics: string[];
  }

  const entityGroups: EntityGroup[] = [];
  const entityMap = new Map<string, string[]>();

  metricColumns.forEach(col => {
    const parts = col.split(' - ');
    if (parts.length === 2) {
      const [entity, metric] = parts;
      if (!entityMap.has(entity)) {
        entityMap.set(entity, []);
      }
      entityMap.get(entity)!.push(col);
    }
  });

  entityMap.forEach((metrics, entity) => {
    entityGroups.push({ entity, metrics });
  });

  // Apply pagination
  const paginatedData = data.slice(0, pageSize);
  const hasMore = data.length > pageSize;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {paginatedData.length} of {data.length} periods</span>
      </div>

      <div className="rounded-md border">
        <div className="relative" style={{ maxHeight: `${maxHeight}px`, overflow: 'auto' }}>
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b">
              {/* First header row - Entity names (merged cells) */}
              <TableRow className="hover:bg-transparent border-b">
                <TableHead 
                  rowSpan={2} 
                  className="text-center align-middle h-9 text-xs font-semibold border-r"
                >
                  {periodColumn}
                </TableHead>
                {entityGroups.map((group, idx) => (
                  <TableHead
                    key={idx}
                    colSpan={group.metrics.length}
                    className="text-center h-9 text-xs font-semibold bg-muted/50 border-r"
                  >
                    {group.entity}
                  </TableHead>
                ))}
              </TableRow>
              
              {/* Second header row - Metric names */}
              <TableRow className="hover:bg-transparent">
                {entityGroups.map((group) =>
                  group.metrics.map((col, idx) => {
                    const metricLabel = col.split(' - ')[1] || col;
                    return (
                      <TableHead 
                        key={col} 
                        className={`h-9 text-xs font-medium ${
                          idx === group.metrics.length - 1 ? 'border-r' : ''
                        }`}
                      >
                        {metricLabel}
                      </TableHead>
                    );
                  })
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, rowIdx) => (
                <TableRow 
                  key={rowIdx} 
                  className="even:bg-muted/30 odd:bg-background hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="py-2 px-3 text-xs font-medium border-r">
                    {row[periodColumn]}
                  </TableCell>
                  {entityGroups.map((group) =>
                    group.metrics.map((col, idx) => (
                      <TableCell 
                        key={col} 
                        className={`py-2 px-3 text-xs text-right font-mono ${
                          idx === group.metrics.length - 1 ? 'border-r' : ''
                        }`}
                      >
                        {row[col] !== null && row[col] !== undefined 
                          ? row[col]
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    ))
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageSize(pageSize === defaultPageSize ? data.length : defaultPageSize)}
            className="h-8 text-xs"
          >
            {pageSize === defaultPageSize ? (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show all ({data.length} rows)
              </>
            ) : (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
