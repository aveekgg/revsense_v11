import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Plus, MessageSquare, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInputWithMentions } from '@/components/chat/ChatInputWithMentions';
import { useChatSession } from '@/hooks/useChatSession';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AskAI = () => {
  const [input, setInput] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    isLoading,
    sessions,
    isLoadingSessions,
    currentSessionId,
    sendMessage,
    createSession,
    switchSession,
    deleteSession,
    isSendingMessage,
  } = useChatSession();

  useEffect(() => {
    console.log('💬 Messages updated:', messages.length, messages);
    console.log('⏳ Is sending message:', isSendingMessage);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSendingMessage]);

  useEffect(() => {
    if (!currentSessionId && !isLoadingSessions && sessions.length === 0) {
      createSession('New Chat');
    } else if (!currentSessionId && sessions.length > 0) {
      switchSession(sessions[0].id);
    }
  }, [currentSessionId, sessions, isLoadingSessions]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !currentSessionId) return;
    console.log('📤 Sending message:', input);
    console.log('📊 Current messages count:', messages.length);
    console.log('⏳ Is sending:', isSendingMessage);
    sendMessage(input);
    setInput('');
  };

  const handleNewChat = () => {
    createSession('New Chat');
  };

  const handleDeleteSession = () => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete);
      setSessionToDelete(null);
    }
  };

  return (
    <>
      <div className="h-full flex">
        {/* Session History Sidebar - Toggleable */}
        {showHistory && (
          <div className="w-64 border-r bg-muted/30 flex flex-col flex-shrink-0">
            <div className="p-4 border-b bg-card">
              <Button 
                onClick={handleNewChat} 
                className="w-full justify-start"
                variant="default"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {isLoadingSessions ? (
                  [...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full mb-2" />
                  ))
                ) : sessions && sessions.length > 0 ? (
                  sessions.map((session) => (
                    <Card
                      key={session.id}
                      className={cn(
                        "p-3 cursor-pointer hover:bg-accent transition-colors group",
                        session.id === currentSessionId && "bg-muted/50 border-muted"
                      )}
                      onClick={() => switchSession(session.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <p className="text-sm font-medium truncate">
                              {session.title || 'New Conversation'}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No conversations yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between p-4 border-b bg-card">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(!showHistory)}
                className="mr-2"
              >
                {showHistory ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
              </Button>
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">AI Assistant</h2>
            </div>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className={cn("mx-auto", showHistory ? "max-w-4xl" : "max-w-5xl")}>
              {messages.length === 0 && !isSendingMessage ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                  <p className="text-muted-foreground max-w-md">
                    Ask me anything about your data. I can help you analyze, visualize, and understand your information.
                  </p>
                </div>
              ) : (
                <>
                  {messages
                    .filter(msg => msg.role !== 'system')
                    .map((message) => (
                    <ChatMessage
                      key={message.id}
                      id={message.id}
                      sessionId={currentSessionId || ''}
                      role={message.role as 'user' | 'assistant'}
                      content={message.content}
                      dataSummary={message.data_summary}
                      sqlQuery={message.sql_query}
                      queryResult={message.query_result}
                      chartSuggestion={message.chart_suggestion ? {
                        chartType: message.chart_suggestion.chartType as 'bar' | 'line' | 'pie' | 'area' | 'table' | 'combo',
                        config: message.chart_suggestion.config,
                        data: message.chart_suggestion.data
                      } : undefined}
                      metadata={message.metadata}
                    />
                  ))}
                  {isSendingMessage && (
                    <div className="flex justify-start mb-4">
                      <Card className="bg-card border-border/50">
                        <div className="p-4 flex items-center gap-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-sm text-muted-foreground">Generating answer...</span>
                        </div>
                      </Card>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-card">
            <div className={cn("mx-auto", showHistory ? "max-w-4xl" : "max-w-5xl")}>
              <form onSubmit={handleSend} className="flex gap-2">
                <ChatInputWithMentions
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSend}
                  disabled={isSendingMessage}
                  placeholder="Ask me anything about your data... (Use @ for entities, ~ for metrics)"
                />
                <Button type="submit" disabled={isSendingMessage || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chat session and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AskAI;
