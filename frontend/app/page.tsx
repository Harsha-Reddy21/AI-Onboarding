'use client';

import { useState, useEffect, useCallback } from 'react';
import { RepoInput } from '@/components/repo-input';
import { ProjectCard } from '@/components/project-card';
import type { Project } from '@/lib/types';
import { api } from '@/lib/api';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.get<{ projects: Project[] }>('/api/ingest');
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    try {
      const data = await api.post<{ projectId: string; status: string }>('/api/ingest', { githubUrl: url });
      await fetchProjects();
    } catch (error) {
      console.error('Failed to submit:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">SeniorBen</h1>
          <p className="text-lg text-muted-foreground">
            Transform any GitHub repository into comprehensive onboarding documentation
          </p>
        </div>

        <RepoInput onSubmit={handleSubmit} isLoading={isLoading} />

        {projects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Your Projects</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        )}

        {projects.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No projects yet. Enter a GitHub URL above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

