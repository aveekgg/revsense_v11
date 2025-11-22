import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

interface SQLViewerProps {
  sql: string;
}

export const SQLViewer = ({ sql }: SQLViewerProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 z-10"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <SyntaxHighlighter
        language="sql"
        style={vscDarkPlus}
        customStyle={{
          borderRadius: '6px',
          padding: '16px',
          fontSize: '13px',
          margin: 0,
        }}
      >
        {sql}
      </SyntaxHighlighter>
    </div>
  );
};
