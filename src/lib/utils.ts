import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Trims text to a specified length and adds ellipsis if truncated
 * @param text - The text to trim
 * @param maxLength - Maximum length before truncating (default: 120)
 * @returns Object with trimmed text and whether it was truncated
 */
export function trimText(text: string | undefined, maxLength: number = 120): { 
  text: string; 
  wasTruncated: boolean 
} {
  if (!text) {
    return { text: '', wasTruncated: false };
  }
  
  if (text.length <= maxLength) {
    return { text, wasTruncated: false };
  }
  
  // Find the last space before the max length to avoid cutting words
  const lastSpace = text.lastIndexOf(' ', maxLength);
  const cutPoint = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;
  
  return {
    text: text.substring(0, cutPoint).trim() + '...',
    wasTruncated: true
  };
}
