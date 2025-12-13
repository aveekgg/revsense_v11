export interface ChartFilter {
  type: 'select' | 'range' | 'text' | 'preset_range';
  label: string;
  placeholder: string;
  options?: string[];
  defaultValue?: any;
  multiple?: boolean;
}