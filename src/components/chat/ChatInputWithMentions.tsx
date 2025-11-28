import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
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
  const [openUpwards, setOpenUpwards] = useState(true); // Default to opening upwards for bottom inputs
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine entity types based on mention trigger
  const entityTypes: EntityType[] | undefined = mentionType === '~' 
    ? ['metric'] 
    : mentionType === '@' 
    ? ['hotel', 'operator', 'legal_entity'] 
    : undefined;

  const { entities } = useEntitySearch(mentionSearch, entityTypes);

  // Debug logging
  useEffect(() => {
    console.log('🔍 Mention Debug:', {
      showMentions,
      mentionType,
      mentionSearch,
      entityTypes,
      entitiesCount: entities.length,
      entities
    });
  }, [showMentions, mentionType, mentionSearch, entityTypes, entities]);

  // Reset selection when entities change
  useEffect(() => {
    setSelectedIndex(0);
  }, [entities]);

  // Calculate dropdown position at cursor/@ symbol location
  const updateDropdownPosition = () => {
    if (!inputRef.current) return;
    
    const input = inputRef.current;
    const inputRect = input.getBoundingClientRect();
    
    // Create a temporary span to measure text width up to the @ symbol
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.style.font = window.getComputedStyle(input).font;
    tempSpan.textContent = input.value.slice(0, mentionStartPos);
    
    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.getBoundingClientRect().width;
    document.body.removeChild(tempSpan);
    
    // Calculate horizontal position
    const inputPaddingLeft = parseInt(window.getComputedStyle(input).paddingLeft) || 12;
    const scrollLeft = input.scrollLeft || 0;
    const leftPos = inputRect.left + inputPaddingLeft + textWidth - scrollLeft;
    
    // Determine if we should open upwards or downwards
    const dropdownHeight = 220; // Approximate max height (max-h-48 + padding + footer)
    const spaceBelow = window.innerHeight - inputRect.bottom;
    const spaceAbove = inputRect.top;
    const shouldOpenUpwards = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    
    setOpenUpwards(shouldOpenUpwards);
    
    // Calculate vertical position
    let topPos;
    if (shouldOpenUpwards) {
      // Open upwards - position above the input
      topPos = inputRect.top - 4; // 4px gap above input
    } else {
      // Open downwards - position below the input
      topPos = inputRect.bottom + 4; // 4px gap below input
    }
    
    setDropdownPosition({
      top: topPos,
      left: leftPos,
    });
  };

  // Update dropdown position when mention state changes
  useEffect(() => {
    if (showMentions) {
      updateDropdownPosition();
      
      // Update position on scroll or resize
      const handleUpdate = () => updateDropdownPosition();
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);
      
      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
      };
    }
  }, [showMentions, mentionStartPos]);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);

    const cursorPos = inputRef.current?.selectionStart || newValue.length;
    
    console.log('📝 Input changed:', { newValue, cursorPos });
    
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
          console.log('✅ Found trigger:', { trigger, mentionPos, i });
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
      console.log('🎯 Setting mention state:', { trigger, searchText, mentionPos });
      setMentionStartPos(mentionPos);
      setMentionType(trigger);
      setMentionSearch(searchText);
      setShowMentions(true);
      updateDropdownPosition();
    } else {
      console.log('❌ No mention trigger found');
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
    <>
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
      </div>
      {showMentions && entities.length > 0 && createPortal(
        <MentionDropdown
          entities={entities}
          selectedIndex={selectedIndex}
          onSelect={insertMention}
          position={dropdownPosition}
          openUpwards={openUpwards}
        />,
        document.body
      )}
    </>
  );
};
