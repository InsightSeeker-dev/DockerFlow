import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setIsSubmitted(true);
      toast.success('Check your email for reset instructions');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="p-0 hover:bg-transparent"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
          </Button>
          <h1 className="text-2xl font-semibold">Check Your Email</h1>
        </div>
        
        <div className="space-y-4 text-gray-400">
          <p>
            If an account exists with {email}, you will receive password reset instructions.
          </p>
          <p>
            Don&apos;t see the email? Check your spam folder or try again.
          </p>
        </div>

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSubmitted(false)}
          >
            Try another email
          </Button>
          <Button
            type="button"
            onClick={onBack}
          >
            Return to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="p-0 hover:bg-transparent"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
        </Button>
        <h1 className="text-2xl font-semibold">Reset Password</h1>
      </div>
      
      <p className="text-gray-400">
        Enter your email address and we&apos;ll send you instructions to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="bg-gray-800 border-gray-700"
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Send Reset Instructions'}
        </Button>
      </form>
    </div>
  );
}
