import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { formatTableCell } from '@/lib/formatters';

interface EnhancedDataTableProps {
  data: any[];
  maxHeight?: number;
  defaultPageSize?: number;
}

export const EnhancedDataTable = ({ 
  data, 
  maxHeight = 400, 
  defaultPageSize = 10 
}: EnhancedDataTableProps) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [openFilterPopover, setOpenFilterPopover] = useState<string | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No data to display
      </div>
    );
  }

  const columns = Object.keys(data[0] || {});

  // Apply filters
  const filteredData = data.filter(row => {
    return Object.entries(filters).every(([column, filterValue]) => {
      if (!filterValue) return true;
      const cellValue = String(row[column] ?? '').toLowerCase();
      return cellValue.includes(filterValue.toLowerCase());
    });
  });

  // Apply sorting
  const sortedData = sortColumn 
    ? [...filteredData].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        // Handle null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
        if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
        
        // Handle numbers
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // Handle strings
        return sortDirection === 'asc' 
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : filteredData;

  // Apply pagination
  const paginatedData = sortedData.slice(0, pageSize);
  const hasMore = sortedData.length > pageSize;

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {paginatedData.length} of {sortedData.length} 
          {filteredData.length < data.length && ` (filtered from ${data.length})`}
        </span>
        {Object.values(filters).some(f => f) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({})}
            className="h-7 text-xs"
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <div className="relative" style={{ maxHeight: `${maxHeight}px`, overflow: 'auto' }}>
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 h-9 text-xs font-semibold">#</TableHead>
                {columns.map(col => (
                  <TableHead key={col} className="h-9 text-xs font-semibold">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSort(col)}
                        className="flex items-center hover:text-foreground transition-colors"
                      >
                        <span className="truncate max-w-[200px]">{col}</span>
                        {getSortIcon(col)}
                      </button>
                      <Popover 
                        open={openFilterPopover === col} 
                        onOpenChange={(open) => setOpenFilterPopover(open ? col : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 w-6 p-0 ${filters[col] ? 'text-primary' : 'opacity-50 hover:opacity-100'}`}
                          >
                            <Filter className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="start">
                          <div className="space-y-2">
                            <label className="text-xs font-medium">Filter {col}</label>
                            <Input
                              placeholder="Type to filter..."
                              value={filters[col] || ''}
                              onChange={(e) => handleFilterChange(col, e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, idx) => (
                <TableRow 
                  key={idx} 
                  className="even:bg-muted/30 odd:bg-background hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="py-1.5 px-3 text-xs text-muted-foreground font-medium">
                    {idx + 1}
                  </TableCell>
                  {columns.map(col => (
                    <TableCell key={col} className="py-1.5 px-3 text-xs font-mono">
                      {row[col] !== null && row[col] !== undefined 
                        ? formatTableCell(row[col], col)
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  ))}
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
            onClick={() => setPageSize(pageSize === defaultPageSize ? sortedData.length : defaultPageSize)}
            className="h-8 text-xs"
          >
            {pageSize === defaultPageSize ? (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show all ({sortedData.length} rows)
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
