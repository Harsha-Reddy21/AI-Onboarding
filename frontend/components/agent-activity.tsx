'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Check, FolderTree, FileText, Search, FileCode, ArrowRight, Image, ChevronDown, ChevronRight } from 'lucide-react';

export interface AgentStep {
  id: string;
  type: 'thinking' | 'tool-call' | 'tool-result' | 'text' | 'step-start' | 'step-finish';
  toolName?: string;
  toolCallId?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  fullOutput?: unknown;
  text?: string;
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'error';
}

interface AgentActivityProps {
  steps: AgentStep[];
  isActive: boolean;
  className?: string;
}

const toolConfig: Record<string, { icon: typeof FolderTree; label: string; color: string }> = {
  listTree: { icon: FolderTree, label: 'Exploring', color: 'text-blue-500' },
  readFile: { icon: FileText, label: 'Reading', color: 'text-green-500' },
  grep: { icon: Search, label: 'Searching', color: 'text-purple-500' },
  createDiagrams: { icon: Image, label: 'Generating diagrams', color: 'text-pink-500' },
  createDocument: { icon: FileCode, label: 'Creating doc', color: 'text-amber-500' },
};

function formatInput(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'listTree':
      return String(input.path || '.');
    case 'readFile':
      return String(input.path || '');
    case 'grep':
      return `"${input.pattern}"${input.filePattern ? ` in ${input.filePattern}` : ''}`;
    case 'createDiagrams': {
      const diagrams = input.diagrams as string[] | undefined;
      return `${diagrams?.length || 0} diagrams`;
    }
    case 'createDocument':
      return String(input.title || 'Document');
    default:
      return JSON.stringify(input);
  }
}

function formatOutput(toolName: string, output: unknown): string | null {
  if (!output) return null;

  if (typeof output === 'string') return output;

  if (typeof output === 'object' && output !== null) {
    const obj = output as Record<string, unknown>;

    switch (toolName) {
      case 'listTree':
        return `${obj.total || 0} items`;
      case 'readFile':
        return `${obj.totalLines || 0} lines`;
      case 'grep':
        return `${obj.total || 0} matches`;
      case 'createDiagrams': {
        const diagrams = obj.diagrams as Array<{ url: string }> | undefined;
        const count = diagrams?.filter(d => d.url).length || 0;
        return `${count} generated`;
      }
      case 'createDocument':
        return `${obj.contentLength || 0} chars`;
      default:
        if ('total' in obj) return `${obj.total} items`;
        if ('totalLines' in obj) return `${obj.totalLines} lines`;
    }
  }

  return 'done';
}

export function AgentActivity({ steps, isActive, className }: AgentActivityProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  // Filter to only tool calls
  const toolCalls = steps.filter(s => s.type === 'tool-call');
  const thinkingStep = steps.filter(s => s.type === 'thinking').pop();

  if (toolCalls.length === 0 && !thinkingStep && !isActive) {
    return null;
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className={cn("", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {isActive ? (
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-green-500" />
        )}
        <span className="text-xs font-medium text-muted-foreground">
          {isActive ? 'Agent exploring...' : `${toolCalls.length} operations completed`}
        </span>
      </div>

      {/* Thinking indicator */}
      {thinkingStep && thinkingStep.text && (
        <div className="mb-3 pl-4 border-l-2 border-amber-300">
          <p className="text-xs text-amber-600 dark:text-amber-400 italic line-clamp-2">
            {thinkingStep.text}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div
        ref={scrollRef}
        className="max-h-[280px] overflow-y-auto space-y-1 pr-2"
      >
        {toolCalls.map((step) => {
          const config = toolConfig[step.toolName || ''] || {
            icon: FileCode,
            label: step.toolName || 'Tool',
            color: 'text-gray-500'
          };
          const Icon = config.icon;
          const outputText = formatOutput(step.toolName || '', step.output);
          const isExpanded = expandedId === step.id;
          const hasFullOutput = step.fullOutput !== undefined && step.fullOutput !== null;

          return (
            <div key={step.id} className="space-y-1">
              {/* Main row */}
              <div
                onClick={() => hasFullOutput && toggleExpand(step.id)}
                className={cn(
                  "flex items-start gap-3 py-2 px-3 rounded-md transition-colors",
                  step.status === 'running' && "bg-blue-50/50 dark:bg-blue-950/20",
                  hasFullOutput && "cursor-pointer hover:bg-muted/50",
                )}
              >
                {/* Expand indicator */}
                <div className="flex-shrink-0 mt-0.5 w-4">
                  {hasFullOutput ? (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )
                  ) : step.status === 'running' ? (
                    <Loader2 className={cn("h-4 w-4 animate-spin", config.color)} />
                  ) : (
                    <Icon className={cn("h-4 w-4", config.color)} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-foreground">
                    {config.label}
                  </span>

                  {step.input && (
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground truncate max-w-[200px]">
                      {formatInput(step.toolName || '', step.input)}
                    </code>
                  )}

                  {outputText && (
                    <>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {outputText}
                      </span>
                    </>
                  )}

                  {step.status === 'running' && !outputText && (
                    <span className="text-xs text-muted-foreground/50">...</span>
                  )}
                </div>
              </div>

              {/* Expanded output */}
              {isExpanded && hasFullOutput && (
                <div className="ml-7 p-2 bg-muted/30 rounded text-xs font-mono overflow-auto max-h-[200px]">
                  <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                    {JSON.stringify(step.fullOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

