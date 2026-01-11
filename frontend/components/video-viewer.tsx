'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Play } from 'lucide-react';
import type { Video } from '@/lib/types';

interface VideoViewerProps {
  video: Video;
  progress?: { message: string; progress?: number };
}

export function VideoViewer({ video, progress }: VideoViewerProps) {
  // Generating state
  if (video.status === 'generating') {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Generating Video</CardTitle>
          <CardDescription>
            The AI is creating your video. This may take several minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-muted flex items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          </div>

          {progress && (
            <div className="w-full max-w-md space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                {progress.message}
              </p>
              {progress.progress !== undefined && (
                <Progress value={progress.progress} className="h-2" />
              )}
            </div>
          )}

          {!progress && (
            <p className="text-sm text-muted-foreground">Initializing...</p>
          )}

          <p className="text-xs text-muted-foreground max-w-sm text-center">
            Creating storyboard, generating images and audio for each slide,
            then compiling into a video.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (video.status === 'error') {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Generation Failed</CardTitle>
          <CardDescription>
            An error occurred while creating the video.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <span className="text-2xl">!</span>
            </div>
            <p className="text-destructive">
              Video generation failed. Please try again.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ready state - show video player
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Video Ready</CardTitle>
            <CardDescription>
              Created on {new Date(video.created_at).toLocaleDateString()}
              {video.storyboard && ` - ${video.storyboard.slides.length} slides`}
            </CardDescription>
          </div>
          {video.video_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={video.video_url} download>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* Video Player */}
        {video.video_url && (
          <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
            <video
              src={video.video_url}
              controls
              className="w-full h-full"
              preload="metadata"
            >
              Your browser does not support video playback.
            </video>
          </div>
        )}

        {/* Storyboard Preview */}
        {video.storyboard && video.storyboard.slides.length > 0 && (
          <div className="flex-shrink-0">
            <h4 className="text-sm font-medium mb-2">
              Storyboard ({video.storyboard.slides.length} slides)
            </h4>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {video.storyboard.slides.map((slide, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-32 p-2 border rounded-md bg-muted/30"
                >
                  <div className="text-xs font-medium truncate mb-1">
                    {i + 1}. {slide.title}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {slide.bullets?.[0] || slide.voiceover.slice(0, 50)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript */}
        {video.transcript && (
          <details className="text-sm flex-shrink-0">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
              View Full Transcript
            </summary>
            <ScrollArea className="h-[150px] mt-2 p-3 bg-muted/30 rounded-md border">
              <pre className="whitespace-pre-wrap text-xs font-mono">
                {video.transcript}
              </pre>
            </ScrollArea>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

