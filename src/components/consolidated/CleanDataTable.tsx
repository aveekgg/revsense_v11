import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
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
}

const PAGE_SIZE = 30;

export function CleanDataTable({
  schema,
  records,
  isLoading,
  onRefresh,
  onClearAll,
  onDeleteRecord,
}: CleanDataTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const tableName = `clean_${schema.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

  // Sort records
  const sortedRecords = [...records].sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    return sortDirection === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  // Paginate records
  const totalPages = Math.ceil(sortedRecords.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRecords = sortedRecords.slice(startIndex, startIndex + PAGE_SIZE);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  const handleExport = (format: 'json' | 'csv') => {
    let data: string;
    if (format === 'json') {
      data = JSON.stringify(records, null, 2);
    } else {
      const headers = ['Source', 'Extracted At', ...schema.fields.map(f => f.displayLabel)];
      const rows = records.map((r: any) => [
        r.source_workbook || '',
        formatTimestamp(r.extracted_at),
        ...schema.fields.map(f => formatValue(r[f.name], f.name, f.type))
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
    toast({ title: "Export successful", description: `Data exported as ${format.toUpperCase()}` });
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

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold mb-1">
              {tableName}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {records.length} {records.length === 1 ? 'record' : 'records'}
              {schema.description && ` • ${schema.description}`}
            </p>
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
              <Button onClick={handleClear} size="sm" variant="destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
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
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/70 select-none"
                      onClick={() => handleSort('source_workbook')}
                    >
                      <div className="flex items-center">
                        Source
                        {getSortIcon('source_workbook')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/70 select-none"
                      onClick={() => handleSort('extracted_at')}
                    >
                      <div className="flex items-center">
                        Extracted
                        {getSortIcon('extracted_at')}
                      </div>
                    </TableHead>
                    {schema.fields.map(field => (
                      <TableHead 
                        key={field.id}
                        className="cursor-pointer hover:bg-muted/70 select-none"
                        onClick={() => handleSort(field.name)}
                      >
                        <div className="flex items-center">
                          {field.displayLabel}
                          {getSortIcon(field.name)}
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
                          {formatValue(record[field.name], field.name, field.type)}
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
                  Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, records.length)} of {records.length} records
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
