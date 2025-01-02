'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { UploadIcon, Loader2 } from 'lucide-react';
import { PullProgress } from './pull-progress';

const pullImageSchema = z.object({
  image: z.string().min(1, 'Image name is required'),
  tag: z.string().default('latest'),
});

type FormData = z.infer<typeof pullImageSchema>;

interface PullImageDialogProps {
  onSuccess: () => void;
}

export function PullImageDialog({ onSuccess }: PullImageDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pullMessages, setPullMessages] = useState<string[]>([]);
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(pullImageSchema),
    defaultValues: {
      image: '',
      tag: 'latest',
    },
  });

  async function onSubmit(data: FormData) {
    if (isLoading) return;
    
    setIsLoading(true);
    setPullMessages([]);
    try {
      const response = await fetch('/api/images/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to pull image');
      }

      // Lire le stream de réponse
      const reader = response.body?.getReader();
      if (reader) {
        let isPullComplete = false;
        while (!isPullComplete) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Traiter les messages du stream
          const text = new TextDecoder().decode(value);
          const lines = text.split('\n').filter(line => line.trim());
          
          setPullMessages(prev => [...prev, ...lines]);
          
          // Vérifier chaque ligne pour détecter la fin du pull
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              if (event.error) {
                throw new Error(event.error);
              }
              // Détecter si c'est le message de fin
              if (event.status === 'Pull completed successfully') {
                isPullComplete = true;
                break;
              }
            } catch (e) {
              console.error('Error parsing stream:', e);
            }
          }
        }
      }

      toast({
        title: 'Success',
        description: 'Image pulled successfully',
      });

      form.reset();
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UploadIcon className="mr-2 h-4 w-4" />
          Pull Image
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pull Docker Image</DialogTitle>
          <DialogDescription>
            Pull a Docker image from a registry.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image Name</FormLabel>
                  <FormControl>
                    <Input placeholder="nginx" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the name of the Docker image you want to pull.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tag</FormLabel>
                  <FormControl>
                    <Input placeholder="latest" {...field} />
                  </FormControl>
                  <FormDescription>
                    Specify the tag of the image (default: latest).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isLoading && pullMessages.length > 0 && (
              <PullProgress messages={pullMessages} />
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} type="button">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pulling...
                  </>
                ) : (
                  <>
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Pull Image
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}