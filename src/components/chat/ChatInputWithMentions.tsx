import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { MentionDropdown } from './MentionDropdown';
import { useEntitySearch, ChatEntity, EntityType } from '@/hooks/useChatEntities';

interface ChatInputWithMentionsProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInputWithMentions = ({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: ChatInputWithMentionsProps) => {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionType, setMentionType] = useState<'@' | '~' | null>(null);
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine entity types based on mention trigger
  const entityTypes: EntityType[] | undefined = mentionType === '~' 
    ? ['metric'] 
    : mentionType === '@' 
    ? ['hotel', 'operator', 'legal_entity'] 
    : undefined;

  const { entities } = useEntitySearch(mentionSearch, entityTypes);

  // Reset selection when entities change
  useEffect(() => {
    setSelectedIndex(0);
  }, [entities]);

  // Calculate dropdown position relative to input
  const updateDropdownPosition = () => {
    if (!inputRef.current) return;
    
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
  };

  const handleInputChange = (newValue: string) => {
    onChange(newValue);

    const cursorPos = inputRef.current?.selectionStart || newValue.length;
    
    // Find mention trigger before cursor
    let mentionPos = -1;
    let trigger: '@' | '~' | null = null;

    // Look backwards from cursor position for @ or ~
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = newValue[i];
      if (char === '@' || char === '~') {
        // Check if it's at the start or preceded by whitespace
        if (i === 0 || /\s/.test(newValue[i - 1])) {
          mentionPos = i;
          trigger = char as '@' | '~';
          break;
        }
      }
      // Stop if we hit whitespace without finding a trigger
      if (/\s/.test(char)) {
        break;
      }
    }

    if (mentionPos !== -1 && trigger) {
      const searchText = newValue.slice(mentionPos + 1, cursorPos);
      setMentionStartPos(mentionPos);
      setMentionType(trigger);
      setMentionSearch(searchText);
      setShowMentions(true);
      updateDropdownPosition();
    } else {
      setShowMentions(false);
      setMentionType(null);
      setMentionSearch('');
    }
  };

  const insertMention = (entity: ChatEntity) => {
    const before = value.slice(0, mentionStartPos);
    const after = value.slice(inputRef.current?.selectionStart || value.length);
    const newValue = `${before}${entity.name}${after}`;
    
    onChange(newValue);
    setShowMentions(false);
    setMentionType(null);
    setMentionSearch('');
    
    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
      const newPos = mentionStartPos + entity.name.length;
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showMentions && entities.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % entities.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + entities.length) % entities.length);
          break;
        case 'Enter':
          e.preventDefault();
          insertMention(entities[selectedIndex]);
          break;
        case 'Escape':
          e.preventDefault();
          setShowMentions(false);
          break;
        case 'Tab':
          e.preventDefault();
          insertMention(entities[selectedIndex]);
          break;
        default:
          break;
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type @ for entities or ~ for metrics..."}
        disabled={disabled}
        className="flex-1"
      />
      {showMentions && entities.length > 0 && (
        <MentionDropdown
          entities={entities}
          selectedIndex={selectedIndex}
          onSelect={insertMention}
          position={dropdownPosition}
        />
      )}
    </div>
  );
};
