import { useState } from "react";
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { UploadIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const MAX_MESSAGES = 100;

interface PullMessage {
  status?: string;
  error?: string;
  progress?: string;
  id?: string;
}

export function PullImageDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pullMessages, setPullMessages] = useState<string[]>([]);
  const [imageRef, setImageRef] = useState("");
  const [error, setError] = useState("");

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    if (!isLoading) {
      setOpen(false);
      setImageRef("");
      setPullMessages([]);
      setError("");
    }
  };

  const isValidImageRef = (ref: string) => {
    return ref.trim().length > 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidImageRef(imageRef)) {
      setError("Please enter a valid image reference");
      return;
    }

    setIsLoading(true);
    setPullMessages([]);
    setError("");

    try {
      // Découper l'image et le tag (ex: 'nginx:1.25' => image='nginx', tag='1.25')
      let img = imageRef.trim();
      let tag = 'latest';
      if (img.includes(':')) {
        [img, tag] = img.split(':');
      }
      const response = await fetch('/api/images/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: img, tag }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n");

        lines.forEach((line) => {
          if (line.trim()) {
            try {
              const message = JSON.parse(line) as PullMessage;
              let displayMessage = "";

              if (message.status) {
                displayMessage = message.status;
              }
              if (message.progress) {
                displayMessage = `${message.status}: ${message.progress}`;
              }
              if (message.error) {
                displayMessage = `Error: ${message.error}`;
              }

              if (displayMessage) {
                setPullMessages((prev) => {
                  const newMessages = [...prev, displayMessage];
                  return newMessages.slice(-MAX_MESSAGES);
                });
              }
            } catch (parseError) {
              setPullMessages((prev) => {
                const newMessages = [...prev, `Error parsing message: ${String(parseError)}`];
                return newMessages.slice(-MAX_MESSAGES);
              });
            }
          }
        });
      }

      toast.success("Image pulled successfully");
      onSuccess();
      setOpen(false);
    } catch (error) {
      setError(`Failed to pull image: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClickOpen}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
      >
        <UploadIcon className="mr-2 h-4 w-4" />
        Pull Image
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
            <div className="flex flex-col space-y-2 text-center sm:text-left">
              <h2 className="text-lg font-semibold">Pull Docker Image</h2>
              <p className="text-sm text-muted-foreground">
                Enter the image reference to pull from Docker Hub or another registry.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {error && (
                <Alert variant="destructive">
                  <p>{error}</p>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Image Reference</label>
                <Input
                  value={imageRef}
                  onChange={(e) => setImageRef(e.target.value)}
                  placeholder="e.g., nginx:latest"
                  disabled={isLoading}
                />
                <p className="text-sm text-gray-500">
                  Enter the full image reference (e.g., nginx:latest, ubuntu:20.04).
                </p>
              </div>

              {pullMessages.length > 0 && (
                <div className="max-h-60 overflow-y-auto border rounded p-2 bg-gray-50">
                  {pullMessages.map((msg, idx) => (
                    <div key={idx} className="text-sm">
                      {msg}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Pulling...
                    </>
                  ) : (
                    'Pull'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
