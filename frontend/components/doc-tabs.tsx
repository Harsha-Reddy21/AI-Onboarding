'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocViewer } from './doc-viewer';
import { ChatInterface } from './chat-interface';
import type { DocType } from '@/lib/types';

interface DocTabsProps {
  projectId: string;
  projectMd?: string | null;
}

const docTypes: { value: DocType; label: string }[] = [
  { value: 'overview', label: 'Platform Overview' },
  { value: 'how_it_works', label: 'How It Works' },
  { value: 'training', label: 'Employee Training' },
  { value: 'terms', label: 'Terms & Features' },
  { value: 'user_journeys', label: 'User Journeys' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
];

export function DocTabs({ projectId, projectMd }: DocTabsProps) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-7">
        {docTypes.map((doc) => (
          <TabsTrigger key={doc.value} value={doc.value}>
            {doc.label}
          </TabsTrigger>
        ))}
        <TabsTrigger value="chat">Q&A</TabsTrigger>
      </TabsList>

      {docTypes.map((doc) => (
        <TabsContent key={doc.value} value={doc.value}>
          <DocViewer projectId={projectId} docType={doc.value} projectMd={projectMd} />
        </TabsContent>
      ))}

      <TabsContent value="chat">
        <ChatInterface projectId={projectId} />
      </TabsContent>
    </Tabs>
  );
}

