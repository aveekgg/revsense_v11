import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Trash2, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, Filter, ChevronDown as ChevronDownIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatValue, formatTimestamp } from '@/lib/formatters';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Field {
  id: string;
  name: string;
  displayLabel: string;
  type: string;
}

interface Schema {
  id: string;
  name: string;
  description?: string;
  fields: Field[];
}

interface CleanDataTableProps {
  schema: Schema;
  records: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onClearAll: () => void;
  onDeleteRecord: (id: string) => void;
  onDeleteFilteredRecords?: (recordIds: string[]) => void;
}

const PAGE_SIZE = 30;

interface SortConfig {
  column: string | null;
  direction: 'asc' | 'desc';
}

interface ColumnFilters {
  [key: string]: string;
}

interface OpenFilters {
  [key: string]: boolean;
}

export function CleanDataTable({
  schema,
  records,
  isLoading,
  onRefresh,
  onClearAll,
  onDeleteRecord,
  onDeleteFilteredRecords,
}: CleanDataTableProps) {
  // Multi-level sorting state
  const [sort1, setSort1] = useState<SortConfig>({ column: null, direction: 'asc' });
  const [sort2, setSort2] = useState<SortConfig>({ column: null, direction: 'asc' });
  
  // Column filtering state
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [openFilters, setOpenFilters] = useState<OpenFilters>({});
  
  const [currentPage, setCurrentPage] = useState(1);

  const tableName = `clean_${schema.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

  // Get available columns for sorting/filtering
  const availableColumns = [
    { value: 'source_workbook', label: 'Source' },
    { value: 'extracted_at', label: 'Extracted At' },
    ...schema.fields.map(field => ({ value: field.name, label: field.displayLabel }))
  ];

  // Get filterable columns (only text and enum fields)
  const filterableColumns = [
    { value: 'source_workbook', label: 'Source', type: 'text' },
    ...schema.fields.filter(field => field.type === 'text' || field.type === 'enum')
      .map(field => ({ value: field.name, label: field.displayLabel, type: field.type }))
  ];

  // Check if a column should have a filter
  const isFilterableColumn = (column: string): boolean => {
    if (column === 'source_workbook') return true;
    const field = schema.fields.find(f => f.name === column);
    return field ? (field.type === 'text' || field.type === 'enum') : false;
  };

  // Helper function for value comparison
  const compareValues = (aVal: any, bVal: any, direction: 'asc' | 'desc') => {
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    
    let result = 0;
    if (!isNaN(aNum) && !isNaN(bNum)) {
      result = aNum - bNum;
    } else {
      result = String(aVal).localeCompare(String(bVal));
    }
    
    return direction === 'asc' ? result : -result;
  };

  // Apply column filters
  const filteredRecords = records.filter(record => {
    return Object.entries(columnFilters).every(([column, filterValue]) => {
      if (!filterValue.trim()) return true;
      if (!isFilterableColumn(column)) return true; // Skip non-filterable columns
      
      let cellValue = '';
      if (column === 'source_workbook') {
        cellValue = record.source_workbook || '';
      } else {
        const field = schema.fields.find(f => f.name === column);
        if (field && (field.type === 'text' || field.type === 'enum')) {
          cellValue = formatValue(record[column], field.name, field.type, record.reporting_currency);
        }
      }
      
      return cellValue.toLowerCase().includes(filterValue.toLowerCase());
    });
  });

  // Hierarchical sorting: Sort1 (primary grouping) then Sort2 (within groups)
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    // Primary sort (Sort 1)
    if (sort1.column) {
      const aVal1 = a[sort1.column];
      const bVal1 = b[sort1.column];
      
      const comparison1 = compareValues(aVal1, bVal1, sort1.direction);
      if (comparison1 !== 0) return comparison1;
      
      // Secondary sort (Sort 2) - only applied within same primary group
      if (sort2.column) {
        const aVal2 = a[sort2.column];
        const bVal2 = b[sort2.column];
        return compareValues(aVal2, bVal2, sort2.direction);
      }
    }
    
    return 0;
  });

  // Paginate records
  const totalPages = Math.ceil(sortedRecords.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRecords = sortedRecords.slice(startIndex, startIndex + PAGE_SIZE);

  // Handle column filter changes
  const handleFilterChange = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Toggle filter input visibility
  const toggleFilter = (column: string) => {
    setOpenFilters(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  // Check if any filter is active for a column
  const hasActiveFilter = (column: string) => {
    return columnFilters[column] && columnFilters[column].trim() !== '';
  };

  // Handle sort configuration changes  
  const handleSort1Change = (column: string | null) => {
    setSort1(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  };

  const handleSort2Change = (column: string | null) => {
    setSort2(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  };

  // Legacy column header click (now sets as Sort 1)
  const handleSort = (column: string) => {
    handleSort1Change(column);
  };

  // Get sort icon for column headers
  const getSortIcon = (column: string) => {
    const isSort1 = sort1.column === column;
    const isSort2 = sort2.column === column;
    
    if (!isSort1 && !isSort2) {
      return <ChevronsUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
    }
    
    const direction = isSort1 ? sort1.direction : sort2.direction;
    const IconComponent = direction === 'asc' ? ChevronUp : ChevronDown;
    const colorClass = isSort1 ? 'text-blue-500' : 'text-green-500'; // Different colors for sort levels
    
    return <IconComponent className={`h-3 w-3 ml-1 ${colorClass}`} />;
  };

  const handleExport = (format: 'json' | 'csv') => {
    const dataToExport = sortedRecords; // Use filtered and sorted data
    let data: string;
    if (format === 'json') {
      data = JSON.stringify(dataToExport, null, 2);
    } else {
      const headers = ['Source', 'Extracted At', ...schema.fields.map(f => f.displayLabel)];
      const rows = dataToExport.map((r: any) => [
        r.source_workbook || '',
        formatTimestamp(r.extracted_at),
        ...schema.fields.map(f => formatValue(r[f.name], f.name, f.type, r.reporting_currency))
      ]);
      data = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    }
    
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema.name}_export.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const filterInfo = Object.keys(columnFilters).filter(k => columnFilters[k]).length > 0 ? ' (filtered)' : '';
    toast({ title: "Export successful", description: `${dataToExport.length} records exported as ${format.toUpperCase()}${filterInfo}` });
  };

  const handleDelete = (recordId: string) => {
    if (window.confirm('Delete this record?')) {
      onDeleteRecord(recordId);
    }
  };

  const handleClear = () => {
    if (window.confirm(`Clear all data from "${schema.name}"?`)) {
      onClearAll();
    }
  };

  const handleDeleteFiltered = () => {
    const filteredIds = sortedRecords.map(record => record.id);
    const isFiltered = sortedRecords.length !== records.length;
    
    if (filteredIds.length === 0) {
      toast({ title: "No records to delete", variant: "destructive" });
      return;
    }
    
    const message = isFiltered 
      ? `Delete ${filteredIds.length} filtered record${filteredIds.length === 1 ? '' : 's'}?`
      : `Delete all ${filteredIds.length} record${filteredIds.length === 1 ? '' : 's'}?`;
      
    if (window.confirm(message)) {
      if (onDeleteFilteredRecords) {
        onDeleteFilteredRecords(filteredIds);
      }
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold mb-1">
              {tableName}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {sortedRecords.length} {sortedRecords.length === 1 ? 'record' : 'records'}
              {sortedRecords.length !== records.length && ` (filtered from ${records.length})`}
              {schema.description && ` • ${schema.description}`}
            </p>
            
            {/* Sorting Controls */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Sort:</span>
              </div>
              
              {/* Sort 1 (Primary) */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">1:</span>
                <Select 
                  value={sort1.column || '__none__'} 
                  onValueChange={(value) => handleSort1Change(value === '__none__' ? null : value)}
                >
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {availableColumns.map(col => (
                      <SelectItem key={col.value} value={col.value}>{col.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sort1.column && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setSort1(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                  >
                    {sort1.direction === 'asc' ? '↑' : '↓'}
                  </Button>
                )}
              </div>
              
              {/* Sort 2 (Secondary) */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">2:</span>
                <Select 
                  value={sort2.column || '__none__'} 
                  onValueChange={(value) => handleSort2Change(value === '__none__' ? null : value)}
                >
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {availableColumns.map(col => (
                      <SelectItem key={col.value} value={col.value}>{col.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sort2.column && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setSort2(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                  >
                    {sort2.direction === 'asc' ? '↑' : '↓'}
                  </Button>
                )}
              </div>
              
              {/* Clear Filters Button */}
              {Object.entries(columnFilters).some(([column, filter]) => 
                filter.trim() !== '' && isFilterableColumn(column)
              ) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setColumnFilters({});
                    setOpenFilters({});
                    setCurrentPage(1);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleExport('csv')} size="sm" variant="outline">
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button onClick={() => handleExport('json')} size="sm" variant="outline">
              <Download className="h-4 w-4 mr-1" />
              JSON
            </Button>
            <Button onClick={onRefresh} size="sm" variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {records.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                    <ChevronDownIcon className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={handleDeleteFiltered}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete {sortedRecords.length !== records.length ? 'Filtered' : 'All'} Records ({sortedRecords.length})
                  </DropdownMenuItem>
                  {sortedRecords.length !== records.length && (
                    <DropdownMenuItem 
                      onClick={handleClear}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete All Records ({records.length})
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No data yet. Apply a mapping to add data.
          </div>
        ) : (
          <>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div 
                            className="cursor-pointer hover:bg-muted/70 select-none flex items-center flex-1"
                            onClick={() => handleSort('source_workbook')}
                          >
                            Source
                            {getSortIcon('source_workbook')}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 w-6 p-0 ml-1 ${hasActiveFilter('source_workbook') ? 'text-blue-500' : 'text-muted-foreground'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFilter('source_workbook');
                            }}
                          >
                            <Filter className="h-3 w-3" />
                          </Button>
                        </div>
                        {openFilters.source_workbook && (
                          <Input
                            placeholder="Filter source..."
                            value={columnFilters.source_workbook || ''}
                            onChange={(e) => handleFilterChange('source_workbook', e.target.value)}
                            className="h-6 text-xs border-muted-foreground/20"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-1">
                        <div 
                          className="cursor-pointer hover:bg-muted/70 select-none flex items-center"
                          onClick={() => handleSort('extracted_at')}
                        >
                          Extracted
                          {getSortIcon('extracted_at')}
                        </div>
                      </div>
                    </TableHead>
                    {schema.fields.map(field => (
                      <TableHead key={field.id}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div 
                              className="cursor-pointer hover:bg-muted/70 select-none flex items-center flex-1"
                              onClick={() => handleSort(field.name)}
                            >
                              {field.displayLabel}
                              {getSortIcon(field.name)}
                            </div>
                            {isFilterableColumn(field.name) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 ml-1 ${hasActiveFilter(field.name) ? 'text-blue-500' : 'text-muted-foreground'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFilter(field.name);
                                }}
                              >
                                <Filter className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {isFilterableColumn(field.name) && openFilters[field.name] && (
                            <Input
                              placeholder={`Filter ${field.displayLabel.toLowerCase()}...`}
                              value={columnFilters[field.name] || ''}
                              onChange={(e) => handleFilterChange(field.name, e.target.value)}
                              className="h-6 text-xs border-muted-foreground/20"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="w-20 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record: any, index: number) => (
                    <TableRow key={record.id} className="hover:bg-muted/30">
                      <TableCell className="text-center text-muted-foreground text-sm">
                        {startIndex + index + 1}
                      </TableCell>
                      <TableCell className="text-sm">{record.source_workbook || '-'}</TableCell>
                      <TableCell className="text-sm">{formatTimestamp(record.extracted_at)}</TableCell>
                      {schema.fields.map(field => (
                        <TableCell key={field.id} className="text-sm">
                          {formatValue(record[field.name], field.name, field.type, record.reporting_currency)}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Button 
                          onClick={() => handleDelete(record.id)} 
                          size="sm" 
                          variant="ghost"
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, sortedRecords.length)} of {sortedRecords.length} records
                  {sortedRecords.length !== records.length && ` (filtered from ${records.length})`}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setCurrentPage(pageNum)}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
