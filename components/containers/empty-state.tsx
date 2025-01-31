'use client';

import { Box, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onCreateClick: () => void;
}

export function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-600/10 text-blue-600">
          <Box className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold text-gray-200">
            Aucun conteneur trouvé
          </h3>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Commencez par créer un nouveau conteneur pour démarrer votre projet
          </p>
        </div>
        <Button
          onClick={onCreateClick}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6"
        >
          <Plus className="h-5 w-5 mr-2" />
          Créer un conteneur
        </Button>
      </div>
    </div>
  );
}
