'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/container';
import { ContainerList } from '@/components/containers';
import { ContainerCreation } from '@/components/containers';
import { useContainers } from '@/hooks/use-containers';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';

export default function ContainersPage() {
  const { containers, isLoading, error, refresh } = useContainers();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Container>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-200">Containers</h1>
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Container
          </Button>
        </div>

        <ContainerList
          containers={containers}
          isLoading={isLoading}
          error={error}
          onRefresh={refresh}
        />

        <ContainerCreation 
          open={isOpen} 
          onOpenChange={setIsOpen} 
          onSuccess={refresh}
        />
      </div>
    </Container>
  );
}