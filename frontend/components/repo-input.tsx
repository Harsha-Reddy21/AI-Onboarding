'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RepoInputProps {
  onSubmit: (url: string) => Promise<void>;
  isLoading?: boolean;
}

export function RepoInput({ onSubmit, isLoading }: RepoInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('Please enter a GitHub URL');
      return;
    }

    // Basic validation
    if (!url.includes('github.com')) {
      setError('Please enter a valid GitHub URL');
      return;
    }

    try {
      await onSubmit(url.trim());
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Repository</CardTitle>
        <CardDescription>
          Enter a public GitHub repository URL to generate onboarding documentation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <Input
              type="url"
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Analyze'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

