'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useContainerCreation } from './hooks/useContainerCreation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DockerImage, Volume } from './types';

interface VolumeConfig {
  createNew: boolean;
  newVolumeName: string;
  volumeId: string;
  mountPath: string;
}

const formSchema = z.object({
  name: z.string()
    .min(3, { message: 'Le nom doit contenir au moins 3 caractères' })
    .max(63, { message: 'Le nom ne peut pas dépasser 63 caractères' })
    .regex(/^[a-z0-9-]+$/, { 
      message: 'Le nom ne peut contenir que des lettres minuscules, des chiffres et des tirets' 
    }),
  image: z.string()
    .min(1, { message: "L'image est requise" })
    .regex(/^[a-zA-Z0-9-_./:-]+$/, {
      message: "Le nom de l'image doit contenir uniquement des lettres, chiffres, tirets, points, slashes et deux-points"
    }),
  subdomain: z.string()
    .min(3, { message: 'Le sous-domaine doit contenir au moins 3 caractères' })
    .max(63, { message: 'Le sous-domaine ne peut pas dépasser 63 caractères' })
    .regex(/^[a-z0-9-]+$/, {
      message: 'Le sous-domaine ne peut contenir que des lettres minuscules, des chiffres et des tirets'
    }),
  volumeConfig: z.object({
    createNew: z.boolean(),
    newVolumeName: z.string(),
    volumeId: z.string(),
    mountPath: z.string()
      .min(1, { message: 'Le chemin de montage est requis' })
      .regex(/^\/[a-zA-Z0-9-_./]*$/, {
        message: 'Le chemin de montage doit commencer par / et ne contenir que des caractères valides'
      })
      .default('/data')
  }).superRefine((volumeConfig, ctx) => {
    if (volumeConfig.createNew) {
      if (!volumeConfig.newVolumeName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Le nom du volume est requis',
          path: ['newVolumeName']
        });
      } else if (!/^[a-z0-9-]+$/.test(volumeConfig.newVolumeName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Le nom du volume ne peut contenir que des lettres minuscules, des chiffres et des tirets',
          path: ['newVolumeName']
        });
      }
    } else {
      if (!volumeConfig.volumeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Veuillez sélectionner un volume existant',
          path: ['volumeId']
        });
      }
    }
  })
});

type FormValues = z.infer<typeof formSchema>;

interface ContainerCreationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ContainerCreation = ({ open, onOpenChange, onSuccess }: ContainerCreationProps) => {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      image: '',
      subdomain: '',
      volumeConfig: {
        createNew: true,
        newVolumeName: '',
        volumeId: '',
        mountPath: '/data'
      }
    },
    mode: 'all'
  });

  const {
    isLoading,
    images,
    volumes,
    fetchImages,
    fetchVolumes,
    handleSubmit: handleFormSubmit,
  } = useContainerCreation({ 
    onSuccess, 
    onClose: () => {
      onOpenChange(false);
      form.reset();
    }
  });

  const createNew = form.watch('volumeConfig.createNew');

  useEffect(() => {
    if (open) {
      // Fetch images and volumes when dialog opens
      Promise.all([
        fetchImages(),
        fetchVolumes()
      ]).catch(error => {
        console.error('Error fetching data:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les données',
          variant: 'destructive',
        });
      });
    }
  }, [open, fetchImages, fetchVolumes, toast]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Créer un conteneur</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => {
            console.log('Form submitted with data:', data);
            handleFormSubmit({
              ...data,
              volumeConfig: {
                ...data.volumeConfig,
                mountPath: data.volumeConfig.mountPath || '/data'
              }
            });
          })} 
          className="grid gap-4 py-4"
          onError={(errors: unknown) => {
            console.error('Form validation errors:', errors);
          }}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom du conteneur</FormLabel>
                <FormControl>
                  <Input
                    placeholder="mon-conteneur"
                    {...field}
                    onChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Utilisez uniquement des lettres, des chiffres et des tirets (3-63 caractères)
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Image Docker</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner une image" />
                    </SelectTrigger>
                    <SelectContent>
                      {images.map((image: DockerImage) => {
                        const tag = image.RepoTags?.[0];
                        return tag ? (
                          <SelectItem key={image.Id} value={tag}>
                            {tag}
                          </SelectItem>
                        ) : null;
                      })}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Sélectionnez l'image Docker pour votre conteneur
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subdomain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sous-domaine</FormLabel>
                <FormControl>
                  <Input
                    placeholder="mon-application"
                    {...field}
                    onChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Votre conteneur sera accessible à l'adresse https://{field.value || 'sous-domaine'}.dockersphere.ovh
                </FormDescription>
              </FormItem>
            )}
          />

          {/* Volume Configuration */}
          <FormField
            control={form.control}
            name="volumeConfig.createNew"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Créer un nouveau volume</FormLabel>
                  <FormDescription>
                    Activez pour créer un nouveau volume ou désactivez pour utiliser un volume existant
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch('volumeConfig.createNew') ? (
            <FormField
              control={form.control}
              name="volumeConfig.newVolumeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du nouveau volume</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="mon-volume"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Utilisez uniquement des lettres minuscules, des chiffres et des tirets
                  </FormDescription>
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="volumeConfig.volumeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sélectionner un volume</FormLabel>
                  <Select
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un volume" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {volumes
                        .filter((volume: Volume) => volume.existsInDocker !== false) // Filtrer les volumes qui n'existent pas dans Docker
                        .map((volume: Volume) => (
                          <SelectItem key={volume.id} value={volume.id}>
                            {volume.name}
                          </SelectItem>
                        ))}
                      {volumes.length > 0 && volumes.filter((v: Volume) => v.existsInDocker !== false).length === 0 && (
                        <div className="px-2 py-4 text-sm text-gray-500 text-center">
                          Aucun volume valide disponible
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="volumeConfig.mountPath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chemin de montage</FormLabel>
                <FormControl>
                  <Input
                    placeholder="/data ou /app/data"
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Chemin où le volume sera monté dans le conteneur (ex: /data)
                </FormDescription>
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            {/* Debug log pour l'état du formulaire */}
            {/* Debug validation */}
            {(() => {
              console.log('Form validation:', {
                isValid: form.formState.isValid,
                isDirty: form.formState.isDirty,
                errors: form.formState.errors,
                values: form.getValues()
              });
              return null;
            })()}
            <Button
              type="submit"
              disabled={isLoading || !form.formState.isValid}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Création en cours...
                </>
              ) : (
                'Créer le conteneur'
              )}
            </Button>
          </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
