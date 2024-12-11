'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    bio: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    // Docker settings
    defaultRegistry: 'docker.io',
    autoUpdate: true,
    resourceLimits: {
      cpu: '0.5',
      memory: '512',
      storage: '10',
    },
    notifications: {
      containerStart: true,
      containerStop: true,
      containerError: true,
      updates: true,
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResourceLimitChange = (key: keyof typeof formData.resourceLimits, value: string) => {
    setFormData(prev => ({
      ...prev,
      resourceLimits: {
        ...prev.resourceLimits,
        [key]: value,
      },
    }));
  };

  const handleNotificationChange = (key: keyof typeof formData.notifications) => {
    setFormData(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAvatar(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (typeof value === 'object') {
          formDataToSend.append(key, JSON.stringify(value));
        } else if (value !== undefined) {
          formDataToSend.append(key, String(value));
        }
      });
      if (avatar) {
        formDataToSend.append('avatar', avatar);
      }

      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        body: formDataToSend,
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      await update(data);

      toast({
        title: 'Success',
        description: 'Your settings have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8 dark:bg-gray-900">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-gray-900 dark:bg-gray-900">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="docker">Docker Settings</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="bg-gray-900 dark:bg-gray-900 border-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription className="text-gray-400 dark:text-gray-300">
                Manage your account information and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={session?.user?.image || ''} />
                    <AvatarFallback>{session?.user?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="max-w-xs bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Your name"
                      className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Your email"
                      type="email"
                      className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <Label>Bio</Label>
                    <Textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      placeholder="Tell us about yourself"
                      rows={4}
                      className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Change Password</h3>
                  <div>
                    <Label>Current Password</Label>
                    <Input
                      name="currentPassword"
                      type="password"
                      value={formData.currentPassword}
                      onChange={handleInputChange}
                      className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <Label>New Password</Label>
                    <Input
                      name="newPassword"
                      type="password"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <Label>Confirm New Password</Label>
                    <Input
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docker">
          <Card className="bg-gray-900 dark:bg-gray-900 border-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Docker Settings</CardTitle>
              <CardDescription className="text-gray-400 dark:text-gray-300">
                Configure your Docker environment preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Default Registry</Label>
                  <Select
                    value={formData.defaultRegistry}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, defaultRegistry: value }))}
                  >
                    <SelectTrigger className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600">
                      <SelectValue placeholder="Select a registry" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 dark:bg-gray-900 border-gray-800 dark:border-gray-700">
                      <SelectItem value="docker.io">Docker Hub</SelectItem>
                      <SelectItem value="ghcr.io">GitHub Container Registry</SelectItem>
                      <SelectItem value="custom">Custom Registry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Update Containers</Label>
                    <p className="text-sm text-gray-400 dark:text-gray-300">
                      Automatically update containers when new images are available
                    </p>
                  </div>
                  <Switch
                    checked={formData.autoUpdate}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoUpdate: checked }))}
                  />
                </div>

                <div className="space-y-4">
                  <Label>Resource Limits</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>CPU (cores)</Label>
                      <Input
                        type="number"
                        value={formData.resourceLimits.cpu}
                        onChange={(e) => handleResourceLimitChange('cpu', e.target.value)}
                        step="0.1"
                        min="0.1"
                        className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <Label>Memory (MB)</Label>
                      <Input
                        type="number"
                        value={formData.resourceLimits.memory}
                        onChange={(e) => handleResourceLimitChange('memory', e.target.value)}
                        step="128"
                        min="128"
                        className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <Label>Storage (GB)</Label>
                      <Input
                        type="number"
                        value={formData.resourceLimits.storage}
                        onChange={(e) => handleResourceLimitChange('storage', e.target.value)}
                        step="1"
                        min="1"
                        className="bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Docker Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="bg-gray-900 dark:bg-gray-900 border-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription className="text-gray-400 dark:text-gray-300">
                Choose which notifications you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Container Start</Label>
                    <p className="text-sm text-gray-400 dark:text-gray-300">
                      Notify when containers start
                    </p>
                  </div>
                  <Switch
                    checked={formData.notifications.containerStart}
                    onCheckedChange={() => handleNotificationChange('containerStart')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Container Stop</Label>
                    <p className="text-sm text-gray-400 dark:text-gray-300">
                      Notify when containers stop
                    </p>
                  </div>
                  <Switch
                    checked={formData.notifications.containerStop}
                    onCheckedChange={() => handleNotificationChange('containerStop')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Container Errors</Label>
                    <p className="text-sm text-gray-400 dark:text-gray-300">
                      Notify on container errors
                    </p>
                  </div>
                  <Switch
                    checked={formData.notifications.containerError}
                    onCheckedChange={() => handleNotificationChange('containerError')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Updates Available</Label>
                    <p className="text-sm text-gray-400 dark:text-gray-300">
                      Notify when updates are available
                    </p>
                  </div>
                  <Switch
                    checked={formData.notifications.updates}
                    onCheckedChange={() => handleNotificationChange('updates')}
                  />
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Notification Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}