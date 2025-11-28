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
  openUpwards?: boolean;
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
  openUpwards = false,
}: MentionDropdownProps) => {
  if (entities.length === 0) return null;

  const style = position 
    ? openUpwards
      ? { bottom: `${window.innerHeight - position.top}px`, left: position.left, transform: 'translateY(0)' }
      : { top: position.top, left: position.left }
    : undefined;

  return (
    <Card
      className="fixed z-50 w-72 shadow-lg border-border"
      style={style}
    >
      <ScrollArea className="max-h-48">
        <div className="p-1">
          {entities.map((entity, index) => (
            <div
              key={entity.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm',
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
                  <span className="font-medium truncate text-sm">{entity.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {getTypeLabel(entity.type)}
                  </span>
                </div>
                {entity.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {entity.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <kbd className="px-1 py-0.5 bg-background border rounded text-[10px]">↑↓</kbd>
          Navigate
          <kbd className="px-1 py-0.5 bg-background border rounded text-[10px]">↵</kbd>
          Select
          <kbd className="px-1 py-0.5 bg-background border rounded text-[10px]">Esc</kbd>
          Close
        </span>
      </div>
    </Card>
  );
};
