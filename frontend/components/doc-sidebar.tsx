'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DocViewer } from './doc-viewer';
import { ChatInterface } from './chat-interface';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { DocType, Document } from '@/lib/types';
import { api } from '@/lib/api';

interface DocSidebarProps {
  projectId: string;
  projectMd?: string | null;
}

// Employee-focused document types for supporting end-users
const docTypes: { value: DocType; label: string; icon: string; description: string }[] = [
  { value: 'overview', label: 'Platform Overview', icon: '🎯', description: 'What the product does and why' },
  { value: 'how_it_works', label: 'How It Works', icon: '⚙️', description: 'Simple explanation of the system' },
  { value: 'training', label: 'Employee Training', icon: '📚', description: 'How to support users effectively' },
  { value: 'terms', label: 'Terms & Features', icon: '📖', description: 'What things mean to users' },
  { value: 'user_journeys', label: 'User Journeys', icon: '🗺️', description: 'Common tasks users perform' },
  { value: 'troubleshooting', label: 'Troubleshooting', icon: '🔧', description: 'Common problems and solutions' },
];

// Employee-focused templates for custom documentation
const docTemplates = [
  {
    id: 'faq',
    title: 'FAQ Document',
    icon: '❓',
    description: 'Common questions users ask and how to answer them',
    prompt: 'Create a FAQ document with common questions users ask about this platform. Include clear, friendly answers that support staff can use when helping users.',
  },
  {
    id: 'feature-guide',
    title: 'Feature Guide',
    icon: '✨',
    description: 'How to explain a specific feature to users',
    prompt: 'Create a guide explaining the main features of this platform. Focus on what each feature does for users and how to help users get the most out of it.',
  },
  {
    id: 'quick-reference',
    title: 'Quick Reference',
    icon: '📋',
    description: 'One-page summary for quick user support',
    prompt: 'Create a quick reference card with the most important information support staff need. Include key features, common issues, and quick answers.',
  },
  {
    id: 'common-issues',
    title: 'Common Issues Guide',
    icon: '🔧',
    description: 'Step-by-step solutions to frequent problems',
    prompt: 'Create a guide covering the most common issues users face and step-by-step solutions. Include what to look for and how to resolve each issue.',
  },
  {
    id: 'new-employee',
    title: 'New Employee Guide',
    icon: '👋',
    description: 'Getting new support staff up to speed',
    prompt: 'Create an onboarding guide for new support staff. Explain what this platform does, who uses it, common user questions, and how to help users effectively.',
  },
];

export function DocSidebar({ projectId, projectMd }: DocSidebarProps) {
  const [activeDoc, setActiveDoc] = useState<DocType | 'chat' | string>('overview');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [customDocs, setCustomDocs] = useState<Document[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocPrompt, setNewDocPrompt] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

  const fetchDocuments = async () => {
    try {
      const data = await api.get<{ documents: Document[] }>(`/api/docs?projectId=${projectId}`);
      setDocuments(data.documents || []);
      const customs = (data.documents || []).filter((d: Document) => d.type === 'custom');
      setCustomDocs(customs);
    } catch {
      // Ignore errors
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = docTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setNewDocTitle(template.title);
      setNewDocPrompt(template.prompt);
    }
  };

  const handleCreateNew = async () => {
    if (!newDocTitle.trim()) return;

    setIsCreating(true);
    setDialogOpen(false);

    // Build the title with optional prompt instructions
    const fullTitle = newDocPrompt.trim()
      ? `${newDocTitle.trim()}: ${newDocPrompt.trim()}`
      : newDocTitle.trim();

    try {
      // Use the streaming endpoint for custom docs
      const response = await fetch(`${api.baseUrl}/api/docs/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          docType: 'custom',
          customTitle: fullTitle,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create document');
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
              if (eventType === 'complete' && data.document) {
                setCustomDocs(prev => [...prev, data.document]);
                setActiveDoc(data.document.id);
                fetchDocuments();
              }
            } catch { /* ignore parse errors */ }
            eventType = '';
          }
        }
      }

      setNewDocTitle('');
      setNewDocPrompt('');
      setSelectedTemplate(null);
    } catch {
      // Handle error - reopen dialog on failure
      setDialogOpen(true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCustomDoc = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingDocId(docId);

    try {
      await api.delete(`/api/docs/${docId}`);
      setCustomDocs(prev => prev.filter(d => d.id !== docId));
      if (activeDoc === docId) {
        setActiveDoc('overview');
      }
      fetchDocuments();
    } catch {
      // Handle error
    } finally {
      setDeletingDocId(null);
    }
  };

  const getDocStatus = (docType: DocType) => {
    return documents.find(d => d.type === docType);
  };

  const renderContent = () => {
    if (activeDoc === 'chat') {
      return <ChatInterface projectId={projectId} />;
    }

    const customDoc = customDocs.find(d => d.id === activeDoc);
    if (customDoc) {
      return (
        <DocViewer
          projectId={projectId}
          docType="custom"
          projectMd={projectMd}
          customDocId={customDoc.id}
          onDocumentDeleted={fetchDocuments}
        />
      );
    }

    return (
      <DocViewer
        projectId={projectId}
        docType={activeDoc as DocType}
        projectMd={projectMd}
        onDocumentDeleted={fetchDocuments}
      />
    );
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Left Sidebar Navigation */}
      <div className="w-56 flex-shrink-0 flex flex-col border rounded-lg bg-muted/30">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Documents</h3>
        </div>

        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {docTypes.map((doc) => {
              const existingDoc = getDocStatus(doc.value);
              return (
                <button
                  key={doc.value}
                  onClick={() => setActiveDoc(doc.value)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left',
                    activeDoc === doc.value
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  )}
                  title={doc.description}
                >
                  <span className="text-base">{doc.icon}</span>
                  <span className="flex-1 truncate">{doc.label}</span>
                  {existingDoc && (
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      activeDoc === doc.value ? "bg-primary-foreground/70" : "bg-green-500"
                    )} />
                  )}
                </button>
              );
            })}

            {/* Custom Documents */}
            {customDocs.length > 0 && (
              <>
                <div className="pt-3 pb-1 px-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom</span>
                </div>
                {customDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm transition-colors group',
                      activeDoc === doc.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    <button
                      onClick={() => setActiveDoc(doc.id)}
                      className="flex items-center gap-3 flex-1 text-left min-w-0"
                    >
                      <span className="text-base">📄</span>
                      <span className="flex-1 truncate">{doc.title}</span>
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className={cn(
                            "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                            activeDoc === doc.id ? "hover:bg-primary-foreground/20" : "hover:bg-destructive/20"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {deletingDocId === doc.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className={cn(
                              "h-3 w-3",
                              activeDoc === doc.id ? "text-primary-foreground" : "text-destructive"
                            )} />
                          )}
                        </button>
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
                            onClick={(e) => handleDeleteCustomDoc(doc.id, e)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </>
            )}

            {/* Q&A Chat */}
            <div className="pt-3 pb-1 px-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chat</span>
            </div>
            <button
              onClick={() => setActiveDoc('chat')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left',
                activeDoc === 'chat'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              <span className="text-base">💬</span>
              <span className="flex-1">Q&A</span>
            </button>
          </nav>
        </ScrollArea>

        {/* Create New Button at Bottom */}
        <div className="p-3 border-t mt-auto">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                <Plus className="h-4 w-4" />
                <span>Create New</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Document</DialogTitle>
                <DialogDescription>
                  Generate custom documentation for your team. Choose a template or create your own.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="templates" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>

                <TabsContent value="templates" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 gap-3">
                    {docTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template.id)}
                        className={cn(
                          "p-4 rounded-lg border text-left transition-colors",
                          selectedTemplate === template.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{template.title}</span>
                          {selectedTemplate === template.id && (
                            <Badge variant="default" className="text-xs">Selected</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </button>
                    ))}
                  </div>

                  {selectedTemplate && (
                    <div className="pt-4 border-t">
                      <Button
                        onClick={handleCreateNew}
                        disabled={isCreating}
                        className="w-full"
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating Documentation...
                          </>
                        ) : (
                          'Generate Documentation'
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        The AI agent will use deep thinking to create comprehensive documentation.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="custom" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="docTitle">Document Title</Label>
                      <Input
                        id="docTitle"
                        placeholder="e.g., Database Migration Guide, Error Handling Patterns..."
                        value={newDocTitle}
                        onChange={(e) => {
                          setNewDocTitle(e.target.value);
                          setSelectedTemplate(null);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="docPrompt">Additional Instructions (Optional)</Label>
                      <Textarea
                        id="docPrompt"
                        placeholder="Provide specific instructions for what the documentation should cover..."
                        value={newDocPrompt}
                        onChange={(e) => setNewDocPrompt(e.target.value)}
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        The AI will explore the codebase and generate documentation based on your title and instructions.
                      </p>
                    </div>

                    <Button
                      onClick={handleCreateNew}
                      disabled={isCreating || !newDocTitle.trim()}
                      className="w-full"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Documentation...
                        </>
                      ) : (
                        'Create Document'
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
}

