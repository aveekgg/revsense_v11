import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChatEntity } from '@/hooks/useChatEntities';
import { Building2, User, Briefcase, TrendingUp } from 'lucide-react';

interface MentionDropdownProps {
  entities: ChatEntity[];
  selectedIndex: number;
  onSelect: (entity: ChatEntity) => void;
  position?: { top: number; left: number };
}

const getEntityIcon = (type: string) => {
  switch (type) {
    case 'hotel':
      return <Building2 className="h-4 w-4 text-blue-500" />;
    case 'operator':
      return <User className="h-4 w-4 text-green-500" />;
    case 'legal_entity':
      return <Briefcase className="h-4 w-4 text-purple-500" />;
    case 'metric':
      return <TrendingUp className="h-4 w-4 text-orange-500" />;
    default:
      return null;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'hotel':
      return 'Hotel';
    case 'operator':
      return 'Operator';
    case 'legal_entity':
      return 'Legal Entity';
    case 'metric':
      return 'Metric';
    default:
      return type;
  }
};

export const MentionDropdown = ({
  entities,
  selectedIndex,
  onSelect,
  position,
}: MentionDropdownProps) => {
  if (entities.length === 0) return null;

  return (
    <Card
      className="absolute z-50 w-80 shadow-lg border-border"
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      <ScrollArea className="max-h-64">
        <div className="p-1">
          {entities.map((entity, index) => (
            <div
              key={entity.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              )}
              onClick={() => onSelect(entity)}
              onMouseEnter={(e) => {
                // Prevent changing selection on hover if navigating with keyboard
                if (e.currentTarget === document.activeElement) return;
              }}
            >
              {getEntityIcon(entity.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{entity.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {getTypeLabel(entity.type)}
                  </span>
                </div>
                {entity.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {entity.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↑↓</kbd>
          Navigate
          <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Enter</kbd>
          Select
          <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Esc</kbd>
          Close
        </span>
      </div>
    </Card>
  );
};
