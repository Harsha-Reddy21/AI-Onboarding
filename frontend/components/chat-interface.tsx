'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { AgentActivity, AgentStep } from '@/components/agent-activity';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // Agent activity for this message (only for assistant messages)
  agentSteps?: AgentStep[];
}

interface ChatInterfaceProps {
  projectId: string;
}

type SessionStatus = 'initializing' | 'ready' | 'error';

export function ChatInterface({ projectId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('initializing');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize session on mount
  // Note: Session management endpoint may need to be added to backend
  const initializeSession = useCallback(async () => {
    setSessionStatus('initializing');
    setSessionError(null);

    try {
      // For now, we'll skip session initialization and let the backend handle it
      // TODO: Add /api/chat/session endpoint to backend if needed
      setSessionId(null); // Backend will create session
      setSessionStatus('ready');
    } catch (error) {
      console.error('Failed to initialize session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to initialize chat');
      setSessionStatus('error');
    }
  }, [projectId]);

  // Initialize session when component mounts
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentSteps]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || sessionStatus !== 'ready') return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentSteps([]);

    const assistantMessageId = crypto.randomUUID();
    let assistantContent = '';
    const steps: AgentStep[] = [];

    // Add empty assistant message placeholder
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      agentSteps: [],
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Use backend URL for SSE streaming
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sessionId,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Parse SSE events
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse complete SSE events from buffer
          const lines = buffer.split('\n');
          buffer = '';

          let currentEvent = '';
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line === '' && currentEvent && currentData) {
              // Process complete event
              try {
                const data = JSON.parse(currentData);

                switch (currentEvent) {
                  case 'session':
                    if (data.sessionId && data.sessionId !== sessionId) {
                      setSessionId(data.sessionId);
                    }
                    break;

                  case 'thinking':
                    // Update or add thinking step
                    const thinkingStep: AgentStep = {
                      id: `thinking-${Date.now()}`,
                      type: 'thinking',
                      text: data.text,
                      timestamp: Date.now(),
                      status: 'running',
                    };
                    // Replace existing thinking step or add new one
                    const thinkingIdx = steps.findIndex(s => s.type === 'thinking');
                    if (thinkingIdx >= 0) {
                      steps[thinkingIdx] = { ...steps[thinkingIdx], text: (steps[thinkingIdx].text || '') + data.text };
                    } else {
                      steps.push(thinkingStep);
                    }
                    setCurrentSteps([...steps]);
                    break;

                  case 'tool_call':
                    const toolCallStep: AgentStep = {
                      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      type: 'tool-call',
                      toolName: data.tool,
                      input: data.args,
                      timestamp: Date.now(),
                      status: 'running',
                    };
                    steps.push(toolCallStep);
                    setCurrentSteps([...steps]);
                    break;

                  case 'tool_result':
                    // Find the last tool call with matching name and update it
                    for (let i = steps.length - 1; i >= 0; i--) {
                      if (steps[i].type === 'tool-call' && steps[i].toolName === data.tool && steps[i].status === 'running') {
                        steps[i] = {
                          ...steps[i],
                          output: data.summary,
                          fullOutput: data.output,
                          status: 'completed',
                        };
                        break;
                      }
                    }
                    setCurrentSteps([...steps]);
                    break;

                  case 'text':
                    assistantContent += data.text;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: assistantContent, agentSteps: [...steps] }
                          : m
                      )
                    );
                    break;

                  case 'complete':
                    // Mark all steps as completed
                    steps.forEach(s => {
                      if (s.status === 'running') s.status = 'completed';
                    });
                    // Clear thinking step at the end
                    const finalSteps = steps.filter(s => s.type !== 'thinking');
                    setCurrentSteps([]);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: assistantContent, agentSteps: finalSteps }
                          : m
                      )
                    );
                    break;

                  case 'error':
                    console.error('Stream error:', data.message);
                    break;
                }
              } catch {
                // Skip invalid JSON
              }

              currentEvent = '';
              currentData = '';
            } else if (line !== '') {
              // Incomplete event, keep in buffer
              buffer += line + '\n';
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev.filter(m => m.id !== assistantMessageId),
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
      setCurrentSteps([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Show loading state while session is initializing
  if (sessionStatus === 'initializing') {
    return (
      <div className="flex flex-col h-full border rounded-lg bg-card items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Preparing chat session...</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Cloning repository for analysis
        </p>
      </div>
    );
  }

  // Show error state if session initialization failed
  if (sessionStatus === 'error') {
    return (
      <div className="flex flex-col h-full border rounded-lg bg-card items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to initialize chat</p>
          <p className="text-sm text-muted-foreground mt-1">{sessionError}</p>
          <Button onClick={initializeSession} className="mt-4" variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <div className="space-y-4 p-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-lg font-medium">Ask questions about this codebase</p>
              <p className="text-sm mt-2">
                The AI will search through the code and provide evidence-based answers with citations.
              </p>
              <p className="text-xs mt-4 text-green-600">
                Session ready - repository is pre-loaded for fast responses
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                  )}
                  <Card
                    className={`p-3 max-w-[80%] ${
                      message.role === 'user' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      message.content ? (
                        <MarkdownRenderer content={message.content} className="text-sm" />
                      ) : (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      )
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                    )}
                  </Card>
                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                  )}
                </div>

                {/* Show agent activity for completed assistant messages */}
                {message.role === 'assistant' && message.agentSteps && message.agentSteps.length > 0 && (
                  <div className="ml-11 mt-2">
                    <AgentActivity
                      steps={message.agentSteps}
                      isActive={false}
                      className="bg-muted/30 rounded-lg p-3"
                    />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Show live agent activity while processing */}
          {isLoading && currentSteps.length > 0 && (
            <div className="ml-11 mt-2">
              <AgentActivity
                steps={currentSteps}
                isActive={true}
                className="bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800"
              />
            </div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the codebase..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

