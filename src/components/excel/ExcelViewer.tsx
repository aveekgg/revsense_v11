import { useEffect, useRef, useState } from 'react';
import { useExcel } from '@/contexts/ExcelContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { columnIndexToLetter } from '@/lib/excelParser';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';
import { toast } from '@/hooks/use-toast';

const ExcelViewer = () => {
  const { workbookData, selectedSheet, setSelectedSheet } = useExcel();
  const [hoveredCell, setHoveredCell] = useState<{ ref: string; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hotInstanceRef = useRef<Handsontable | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: text,
      });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    if (!workbookData || !containerRef.current) return;

    const sheetData = workbookData.sheets[selectedSheet] || [];
    const cellStyles = workbookData.cellStyles?.[selectedSheet] || {};

    // Destroy existing instance
    if (hotInstanceRef.current) {
      hotInstanceRef.current.destroy();
    }

    // Initialize Handsontable
    hotInstanceRef.current = new Handsontable(containerRef.current, {
      data: sheetData,
      colHeaders: true,
      rowHeaders: true,
      width: '100%',
      height: 600,
      licenseKey: 'non-commercial-and-evaluation',
      stretchH: 'all',
      manualColumnResize: true,
      manualRowResize: true,
      contextMenu: false,
      afterOnCellMouseOver: (event, coords) => {
        if (coords.row >= 0 && coords.col >= 0) {
          const cellRef = `${columnIndexToLetter(coords.col)}${coords.row + 1}`;
          const rect = (event.target as HTMLElement).getBoundingClientRect();
          setHoveredCell({ 
            ref: cellRef, 
            x: rect.left + rect.width / 2, 
            y: rect.top 
          });
        }
      },
      afterOnCellMouseOut: () => {
        setHoveredCell(null);
      },
      afterOnCellMouseDown: (event, coords) => {
        if (coords.row >= 0 && coords.col >= 0) {
          const selection = hotInstanceRef.current?.getSelected();
          if (selection && selection.length > 0) {
            const [row, col, row2, col2] = selection[0];
            const startCell = `${columnIndexToLetter(col)}${row + 1}`;
            const endCell = `${columnIndexToLetter(col2)}${row2 + 1}`;
            const range = startCell === endCell ? startCell : `${startCell}:${endCell}`;
            const cellRef = `=${selectedSheet}!${range}`;
            copyToClipboard(cellRef);
          }
        }
      },
      cells: (row, col) => {
        const cellRef = `${columnIndexToLetter(col)}${row + 1}`;
        const style = cellStyles[cellRef];
        const cellData = sheetData[row]?.[col];
        
        const cellProperties: any = {};
        
        // Check if this cell contains a Date object and format it properly
        if (cellData instanceof Date && !isNaN(cellData.getTime())) {
          cellProperties.renderer = function(instance: any, td: HTMLTableCellElement, row: number, col: number, prop: any, value: any, cellProperties: any) {
            // Format date as YYYY-MM-DD
            if (value instanceof Date && !isNaN(value.getTime())) {
              // Excel dates can have time components (like 23:59:50) due to floating point precision
              // Round to nearest day by adding 12 hours and then taking the date components
              const adjustedDate = new Date(value.getTime() + 12 * 60 * 60 * 1000);
              
              const year = adjustedDate.getUTCFullYear();
              const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
              const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;
              td.textContent = dateStr;
            } else {
              td.textContent = value !== null && value !== undefined ? String(value) : '';
            }
            return td;
          };
        }
        
        // Apply text styles via className
        if (style) {
          const classNames: string[] = [];
          if (style.bold) classNames.push('htBold');
          if (style.italic) classNames.push('htItalic');
          if (style.underline) classNames.push('htUnderline');
          
          if (classNames.length > 0) {
            cellProperties.className = classNames.join(' ');
          }
        }
        
        return cellProperties;
      },
      afterRenderer: (TD, row, col, prop, value, cellProperties) => {
        const cellRef = `${columnIndexToLetter(col)}${row + 1}`;
        const style = cellStyles[cellRef];
        
        if (style) {
          if (style.color) {
            TD.style.color = style.color;
          }
          if (style.bgColor) {
            TD.style.backgroundColor = style.bgColor;
          }
          if (style.border) {
            if (style.border.top) TD.style.borderTop = '2px solid #000';
            if (style.border.right) TD.style.borderRight = '2px solid #000';
            if (style.border.bottom) TD.style.borderBottom = '2px solid #000';
            if (style.border.left) TD.style.borderLeft = '2px solid #000';
          }
        }
      }
    });

    return () => {
      if (hotInstanceRef.current) {
        hotInstanceRef.current.destroy();
        hotInstanceRef.current = null;
      }
    };
  }, [workbookData, selectedSheet]);

  if (!workbookData) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Upload an Excel file to view its contents
      </div>
    );
  }

  return (
    <Card className="h-full flex flex-col relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{workbookData.fileName}</CardTitle>
        </div>
        {workbookData.sheetNames.length > 1 && (
          <Tabs value={selectedSheet} onValueChange={setSelectedSheet} className="mt-2">
            <TabsList className="w-full justify-start">
              {workbookData.sheetNames.map(name => (
                <TabsTrigger key={name} value={name}>
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-auto p-4">
        <div ref={containerRef} className="w-full h-[600px]" />
      </CardContent>
      
      {/* Hover Tooltip */}
      {hoveredCell && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{ 
            left: hoveredCell.x, 
            top: hoveredCell.y - 40,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="bg-popover text-popover-foreground px-3 py-1.5 rounded-md shadow-md border text-sm">
            Click to copy: <span className="font-mono font-semibold">{selectedSheet}!{hoveredCell.ref}</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ExcelViewer;
