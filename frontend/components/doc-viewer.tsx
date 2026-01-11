'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { AgentActivity, AgentStep } from '@/components/agent-activity';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import type { Document, DocType } from '@/lib/types';
import { api } from '@/lib/api';

interface DocViewerProps {
  projectId: string;
  docType: DocType;
  projectMd?: string | null;
  customDocId?: string;
  onDocumentDeleted?: () => void;
}

const docTypeInfo: Record<DocType, { title: string; description: string }> = {
  overview: {
    title: 'Platform Overview',
    description: 'What the product does and why users use it',
  },
  how_it_works: {
    title: 'How It Works',
    description: 'Simple explanation of the system for support staff',
  },
  training: {
    title: 'Employee Training',
    description: 'How to support users effectively',
  },
  terms: {
    title: 'Terms & Features',
    description: 'What things mean to users',
  },
  user_journeys: {
    title: 'User Journeys',
    description: 'Common tasks users perform',
  },
  troubleshooting: {
    title: 'Troubleshooting',
    description: 'Common problems and solutions',
  },
  custom: {
    title: 'Custom Documentation',
    description: 'Custom generated documentation',
  },
};

export function DocViewer({ projectId, docType, projectMd, customDocId, onDocumentDeleted }: DocViewerProps) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);

  const info = docTypeInfo[docType];

  useEffect(() => {
    setDoc(null);
    setAgentSteps([]);
    fetchExistingDoc();
  }, [projectId, docType, customDocId]);

  const fetchExistingDoc = async () => {
    try {
      if (customDocId) {
        const data = await api.get<Document>(`/api/docs/${customDocId}`);
        setDoc(data);
        return;
      }

      const data = await api.get<{ documents: Document[] }>(`/api/docs?projectId=${projectId}`);
      const existingDoc = data.documents?.find(
        (d: Document) => d.type === docType
      );
      if (existingDoc) {
        setDoc(existingDoc);
      }
    } catch {
      // Ignore errors when checking for existing doc
    }
  };

  const addAgentStep = useCallback((step: Omit<AgentStep, 'id' | 'timestamp'>) => {
    setAgentSteps(prev => [...prev, {
      ...step,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }]);
  }, []);

  const updateAgentStep = useCallback((toolCallId: string, updates: Partial<AgentStep>) => {
    setAgentSteps(prev => prev.map(step =>
      step.toolCallId === toolCallId ? { ...step, ...updates } : step
    ));
  }, []);

  const generateDoc = async () => {
    setIsLoading(true);
    setError(null);
    setAgentSteps([]);

    try {
      // Use backend URL for SSE streaming
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/api/docs/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, docType }),
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      // Check if it's a direct JSON response (cached doc)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.document) {
          setDoc(data.document);
          setIsLoading(false);
          return;
        }
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent(eventType, data);
            } catch { /* ignore parse errors */ }
            eventType = '';
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate documentation');
      setAgentSteps(prev => prev.map(step => ({ ...step, status: 'error' as const })));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamEvent = (event: string, data: Record<string, unknown>) => {
    switch (event) {
      case 'status':
        addAgentStep({
          type: 'thinking',
          text: data.message as string,
          status: 'running',
        });
        break;
      case 'tool_call':
        addAgentStep({
          type: 'tool-call',
          toolName: data.tool as string,
          input: data.args as Record<string, unknown>,
          status: 'running',
          toolCallId: crypto.randomUUID(),
        });
        break;
      case 'tool_result':
        // Update last tool call with result (summary for display, fullOutput for expand)
        setAgentSteps(prev => {
          const lastToolCall = [...prev].reverse().find(s => s.type === 'tool-call' && s.status === 'running');
          if (lastToolCall) {
            return prev.map(s =>
              s.id === lastToolCall.id ? {
                ...s,
                status: 'completed' as const,
                output: data.summary,
                fullOutput: data.output,
              } : s
            );
          }
          return prev;
        });
        break;
      case 'thinking':
        setAgentSteps(prev => {
          const lastThinking = [...prev].reverse().find(s => s.type === 'thinking');
          if (lastThinking) {
            return prev.map(s =>
              s.id === lastThinking.id ? { ...s, text: data.text as string } : s
            );
          }
          return prev;
        });
        break;
      case 'complete':
        setDoc(data.document as Document);
        setAgentSteps(prev => prev.map(s => ({ ...s, status: 'completed' as const })));
        break;
      case 'error':
        setError(data.message as string);
        setAgentSteps(prev => prev.map(s => ({ ...s, status: 'error' as const })));
        break;
    }
  };

  const handleDelete = async () => {
    if (!doc) return;

    setIsDeleting(true);
    try {
      await api.delete(`/api/docs/${doc.id}`);
      setDoc(null);
      onDocumentDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRegenerate = async () => {
    if (doc) {
      // First delete the existing doc
      try {
        await api.delete(`/api/docs/${doc.id}`);
        setDoc(null);
      } catch {
        // Continue anyway
      }
    }
    generateDoc();
  };

  // Show PROJECT.md for overview if no specific doc exists
  if (docType === 'overview' && projectMd && !doc && !isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{info.title}</CardTitle>
              <CardDescription>{info.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1">
            <div className="pr-4">
              <MarkdownRenderer content={projectMd} />
            </div>
          </ScrollArea>
          <div className="mt-4 flex-shrink-0 flex items-center gap-2">
            <Button onClick={generateDoc} disabled={isLoading}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Platform Overview
            </Button>
            <span className="text-xs text-muted-foreground">
              (AI creates employee-friendly documentation)
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show existing document
  if (doc) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{doc.title}</CardTitle>
              <CardDescription>
                Generated on {new Date(doc.created_at).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerate
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{doc.title}&quot;? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="pr-4">
              <MarkdownRenderer content={doc.content} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  // Show generation state or prompt to generate
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div>
          <CardTitle>{info.title}</CardTitle>
          <CardDescription>{info.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex flex-col">
            {/* Agent Activity - main content when loading */}
            {agentSteps.length > 0 ? (
              <AgentActivity
                steps={agentSteps}
                isActive={isLoading}
                className="flex-1"
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Starting agent...</span>
              </div>
            )}

            {/* Subtle footer note */}
            <p className="text-xs text-muted-foreground mt-auto pt-4 border-t">
              Agent explores the codebase and creates documentation. This may take a few minutes.
            </p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={generateDoc}>Retry</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This documentation hasn&apos;t been generated yet. Click below to generate it.
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={generateDoc}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Documentation
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The AI agent will explore the platform and create
              employee-friendly documentation to help you support users.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

