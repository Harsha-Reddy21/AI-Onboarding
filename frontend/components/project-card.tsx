'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Project } from '@/lib/types';

interface ProjectCardProps {
  project: Project;
}

const statusConfig = {
  pending: { label: 'Pending', variant: 'secondary' as const, progress: 0 },
  scanning: { label: 'Scanning', variant: 'default' as const, progress: 33 },
  generating: { label: 'Generating', variant: 'default' as const, progress: 66 },
  ready: { label: 'Ready', variant: 'default' as const, progress: 100 },
  error: { label: 'Error', variant: 'destructive' as const, progress: 0 },
};

export function ProjectCard({ project }: ProjectCardProps) {
  const config = statusConfig[project.status];
  const isClickable = project.status === 'ready';

  const content = (
    <Card className={isClickable ? 'hover:border-primary/50 transition-colors cursor-pointer' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{project.repo_name}</CardTitle>
            <CardDescription className="text-xs truncate max-w-[250px]">
              {project.github_url}
            </CardDescription>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {project.status === 'scanning' || project.status === 'generating' ? (
          <div className="space-y-2">
            <Progress value={config.progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {project.status === 'scanning' ? 'Analyzing repository...' : 'Generating PROJECT.md...'}
            </p>
          </div>
        ) : project.status === 'error' ? (
          <p className="text-sm text-destructive">{project.error_message || 'An error occurred'}</p>
        ) : project.status === 'ready' ? (
          <p className="text-sm text-muted-foreground">Click to view documentation</p>
        ) : null}
        <p className="text-xs text-muted-foreground mt-2">
          Added {new Date(project.created_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );

  if (isClickable) {
    return <Link href={`/project/${project.id}`}>{content}</Link>;
  }

  return content;
}

