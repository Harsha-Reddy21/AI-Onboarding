'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VideoViewer } from './video-viewer';
import {
  Plus,
  Video as VideoIcon,
  Loader2,
  Trash2,
  Film,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Video, Document } from '@/lib/types';
import { api } from '@/lib/api';

interface VideoSidebarProps {
  projectId: string;
  documents: Document[];
}

interface GenerationProgress {
  message: string;
  progress?: number;
}

export function VideoSidebar({ projectId, documents }: VideoSidebarProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  // Fetch videos on mount
  useEffect(() => {
    fetchVideos();
  }, [projectId]);

  const fetchVideos = async () => {
    try {
      const data = await api.get<{ videos: Video[] }>(`/api/videos?projectId=${projectId}`);
      setVideos(data.videos || []);
    } catch {
      // Ignore errors
    }
  };

  const handleCreateVideo = async () => {
    if (!selectedDocId) return;

    setIsCreating(true);
    setDialogOpen(false);
    setGenerationProgress({ message: 'Starting video generation...' });

    try {
      // Use backend URL for SSE streaming
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/api/videos/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selectedDocId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start video generation');
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let newVideoId: string | null = null;

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
              handleStreamEvent(eventType, data, (id) => {
                newVideoId = id;
              });
            } catch {
              /* ignore parse errors */
            }
            eventType = '';
          }
        }
      }

      // Set active video to the newly created one
      if (newVideoId) {
        setActiveVideoId(newVideoId);
      }
    } catch (error) {
      console.error('Video generation failed:', error);
      setGenerationProgress(null);
    } finally {
      setIsCreating(false);
      setSelectedDocId(null);
      fetchVideos();
    }
  };

  const handleStreamEvent = (
    event: string,
    data: Record<string, unknown>,
    setNewVideoId: (id: string) => void
  ) => {
    switch (event) {
      case 'status':
        setGenerationProgress({
          message: data.message as string,
          progress: data.progress as number | undefined,
        });
        break;

      case 'progress':
        setGenerationProgress({
          message: data.message as string,
          progress: data.progress as number | undefined,
        });
        break;

      case 'storyboard':
        setGenerationProgress({
          message: `Storyboard created with ${data.slides} slides`,
          progress: 15,
        });
        break;

      case 'slide_start':
        setGenerationProgress({
          message: `Processing slide ${data.current}/${data.total}: ${data.title}`,
          progress: 15 + Math.round(((data.current as number) / (data.total as number)) * 80),
        });
        break;

      case 'slide_complete':
        setGenerationProgress({
          message: `Completed slide ${data.current}/${data.total}`,
          progress: 15 + Math.round(((data.current as number) / (data.total as number)) * 80),
        });
        break;

      case 'complete':
        setGenerationProgress(null);
        if (data.video) {
          const video = data.video as Video;
          setVideos((prev) => {
            // Replace if exists, add if new
            const exists = prev.some((v) => v.id === video.id);
            if (exists) {
              return prev.map((v) => (v.id === video.id ? video : v));
            }
            return [...prev, video];
          });
          setNewVideoId(video.id);
        }
        break;

      case 'error':
        setGenerationProgress(null);
        console.error('Video generation error:', data.message);
        break;
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    setDeletingVideoId(videoId);

    try {
      await api.delete(`/api/videos/${videoId}`);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      if (activeVideoId === videoId) {
        setActiveVideoId(null);
      }
    } catch {
      // Ignore errors
    } finally {
      setDeletingVideoId(null);
    }
  };

  const activeVideo = videos.find((v) => v.id === activeVideoId);

  // If we're generating and have an active video that's still generating,
  // show progress in the viewer
  const showProgress = isCreating || (activeVideo?.status === 'generating');

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col border rounded-lg bg-muted/30">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Videos
          </h3>
        </div>

        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {videos.length === 0 && !isCreating && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Film className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No videos yet</p>
                <p className="text-xs mt-1">
                  Create a video from one of your documents
                </p>
              </div>
            )}

            {videos.map((video) => {
              const doc = documents.find((d) => d.id === video.document_id);
              const isGenerating = video.status === 'generating';

              return (
                <div
                  key={video.id}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm transition-colors group',
                    activeVideoId === video.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  <button
                    onClick={() => setActiveVideoId(video.id)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <VideoIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate">
                      {doc?.title || 'Video'}
                    </span>
                    {isGenerating && (
                      <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                    )}
                    {video.status === 'error' && (
                      <Badge variant="destructive" className="text-xs">
                        Error
                      </Badge>
                    )}
                  </button>

                  {/* Delete button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className={cn(
                          'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                          activeVideoId === video.id
                            ? 'hover:bg-primary-foreground/20'
                            : 'hover:bg-destructive/20'
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {deletingVideoId === video.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2
                            className={cn(
                              'h-3 w-3',
                              activeVideoId === video.id
                                ? 'text-primary-foreground'
                                : 'text-destructive'
                            )}
                          />
                        )}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Video</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this video? This
                          action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteVideo(video.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Create New Button */}
        <div className="p-3 border-t mt-auto">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                size="sm"
                disabled={isCreating || documents.length === 0}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>Create Video</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Video from Document</DialogTitle>
                <DialogDescription>
                  Select a document to convert into a video presentation. The AI
                  will create a 7-10 slide video with images and narration.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No documents available. Generate some documentation first.
                  </p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-4">
                      {documents.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => setSelectedDocId(doc.id)}
                          className={cn(
                            'w-full p-3 rounded-lg border text-left transition-colors',
                            selectedDocId === doc.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          )}
                        >
                          <div className="font-medium">{doc.title}</div>
                          <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {doc.content.slice(0, 150)}...
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                <Button
                  onClick={handleCreateVideo}
                  disabled={!selectedDocId || isCreating}
                  className="w-full"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Video...
                    </>
                  ) : (
                    'Create Video'
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Video generation typically takes 5-10 minutes depending on the
                  document length.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {activeVideo ? (
          <VideoViewer
            video={activeVideo}
            progress={showProgress ? generationProgress || undefined : undefined}
          />
        ) : isCreating ? (
          <VideoViewer
            video={{
              id: 'generating',
              document_id: selectedDocId || '',
              status: 'generating',
              video_url: null,
              transcript: null,
              storyboard: null,
              created_at: new Date().toISOString(),
            }}
            progress={generationProgress || undefined}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground border rounded-lg bg-muted/10">
            <Film className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">No video selected</p>
            <p className="text-sm mt-1">
              Select a video or create a new one from a document
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

