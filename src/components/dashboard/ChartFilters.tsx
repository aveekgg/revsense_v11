import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format, subMonths, startOfDay, endOfDay } from 'date-fns';
import { CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { ChartFilter } from '@/types/dashboard';

interface ChartFiltersProps {
  filters: ChartFilter[];
  onFiltersChange: (values: Record<string, any>) => void;
  initialValues?: Record<string, any>;
}

const ChartFilters: React.FC<ChartFiltersProps> = ({ filters, onFiltersChange, initialValues = {} }) => {
  const [filterValues, setFilterValues] = useState<Record<string, any>>(initialValues);

  // Sync with initialValues when they change (don't call onFiltersChange to avoid loops)
  useEffect(() => {
    setFilterValues(initialValues);
  }, [JSON.stringify(initialValues)]);

  const handleChange = (placeholder: string, value: any) => {
    let processedValue = value;
    if (filters.find(f => f.placeholder === placeholder)?.type === 'preset_range' && value) {
      // Calculate dates for presets
      const now = new Date();
      if (value === 'Last 12 Months') {
        processedValue = { start: subMonths(now, 12), end: now };
      } else if (value === 'Last 6 Months') {
        processedValue = { start: subMonths(now, 6), end: now };
      } else if (value === 'Last 30 Days') {
        processedValue = { start: subMonths(now, 1), end: now };
      }
    }
    const newValues = { ...filterValues, [placeholder]: processedValue };
    setFilterValues(newValues);
    onFiltersChange(newValues);
  };

  return (
    <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
      {filters.map(filter => (
        <div key={filter.placeholder} className="flex flex-col space-y-2 min-w-[200px]">
          <label className="text-sm font-medium">{filter.label}</label>
          {filter.type === 'select' && (
            <div className="space-y-2">
              {filter.multiple ? (
                // Elegant multi-select with Command (searchable)
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-between w-full"
                    >
                      <span className="truncate">
                        {Array.isArray(filterValues[filter.placeholder]) && filterValues[filter.placeholder].length > 0
                          ? `${filterValues[filter.placeholder].length} selected`
                          : `Select ${filter.label.toLowerCase()}`}
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder={`Search ${filter.label.toLowerCase()}...`} />
                      <CommandList>
                        <CommandEmpty>No options found.</CommandEmpty>
                        <CommandGroup>
                          {filter.options?.filter(option => option.trim()).map(option => {
                            const isSelected = Array.isArray(filterValues[filter.placeholder]) && filterValues[filter.placeholder].includes(option);
                            return (
                              <CommandItem
                                key={option}
                                className="flex items-center space-x-2 cursor-pointer"
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const currentValues = Array.isArray(filterValues[filter.placeholder]) ? filterValues[filter.placeholder] : [];
                                    const newValues = checked
                                      ? [...currentValues, option]
                                      : currentValues.filter((v: string) => v !== option);
                                    handleChange(filter.placeholder, newValues);
                                  }}
                                />
                                <span>{option}</span>
                                {isSelected && <Check className="h-4 w-4 ml-auto" />}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                        {filter.options && filter.options.length > 1 && (
                          <CommandGroup>
                            <CommandItem
                              className="justify-center font-medium"
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const currentValues = Array.isArray(filterValues[filter.placeholder]) ? filterValues[filter.placeholder] : [];
                                  const allValues = currentValues.length === filter.options.length
                                    ? [] // Deselect all
                                    : filter.options; // Select all
                                  handleChange(filter.placeholder, allValues);
                                }}
                                className="w-full text-xs"
                              >
                                {Array.isArray(filterValues[filter.placeholder]) && filterValues[filter.placeholder].length === filter.options.length
                                  ? 'Deselect All'
                                  : 'Select All'}
                              </Button>
                            </CommandItem>
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                // Single select
                <Select
                  value={filterValues[filter.placeholder] || ''}
                  onValueChange={(value) => handleChange(filter.placeholder, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options?.filter(option => option.trim()).map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {filter.type === 'preset_range' && (
            <Select
              value={filterValues[filter.placeholder]?.label || ''}
              onValueChange={(value) => handleChange(filter.placeholder, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {filter.options?.filter(option => option.trim()).map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {filter.type === 'range' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterValues[filter.placeholder]?.start ? (
                    filterValues[filter.placeholder]?.end ? (
                      <>
                        {format(filterValues[filter.placeholder].start, 'PPP')} -{' '}
                        {format(filterValues[filter.placeholder].end, 'PPP')}
                      </>
                    ) : (
                      format(filterValues[filter.placeholder].start, 'PPP')
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={filterValues[filter.placeholder]?.start}
                  selected={filterValues[filter.placeholder]}
                  onSelect={(range) => handleChange(filter.placeholder, range)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
          {filter.type === 'text' && (
            <Input
              type="text"
              value={filterValues[filter.placeholder] || ''}
              onChange={(e) => handleChange(filter.placeholder, e.target.value)}
              placeholder={`Enter ${filter.label.toLowerCase()}`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default ChartFilters;