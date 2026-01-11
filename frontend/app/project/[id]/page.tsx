'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { DocSidebar } from '@/components/doc-sidebar';
import { VideoSidebar } from '@/components/video-sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Video } from 'lucide-react';
import type { Project, Document } from '@/lib/types';
import { api } from '@/lib/api';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const data = await api.get<Project>(`/api/ingest/${id}`);
        setProject(data);
      } catch (err: any) {
        if (err.message?.includes('404')) {
          setError('Project not found');
        } else {
          setError('Failed to load project');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  // Fetch documents when project is ready (for video creation)
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!project || project.status !== 'ready') return;
      try {
        const data = await api.get<{ documents: Document[] }>(`/api/docs?projectId=${project.id}`);
        setDocuments(data.documents || []);
      } catch {
        // Ignore errors
      }
    };

    fetchDocuments();
  }, [project]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <h1 className="text-2xl font-bold">{error || 'Project not found'}</h1>
          <Button onClick={() => router.push('/')}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  if (project.status !== 'ready') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <h1 className="text-2xl font-bold">{project.repo_name}</h1>
          <Badge variant={project.status === 'error' ? 'destructive' : 'default'}>
            {project.status}
          </Badge>
          {project.status === 'error' && (
            <p className="text-destructive">{project.error_message}</p>
          )}
          {(project.status === 'scanning' || project.status === 'generating') && (
            <p className="text-muted-foreground">Please wait while we analyze the repository...</p>
          )}
          <Button onClick={() => router.push('/')}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.repo_name}</h1>
            <p className="text-sm text-muted-foreground">
              Commit: {project.commit_sha.slice(0, 7)}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/')}>
            Back to Projects
          </Button>
        </div>

        <Tabs defaultValue="docs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="docs" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-2">
              <Video className="h-4 w-4" />
              Videos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="docs" className="mt-0">
            <DocSidebar projectId={project.id} projectMd={project.project_md} />
          </TabsContent>

          <TabsContent value="videos" className="mt-0">
            <VideoSidebar projectId={project.id} documents={documents} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

