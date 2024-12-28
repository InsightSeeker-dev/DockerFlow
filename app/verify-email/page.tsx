'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/users/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });
        
        if (response.ok) {
          setStatus('success');
          setMessage('Email verified successfully. You can now log in to your account.');
        } else {
          setStatus('error');
          const data = await response.json().catch(() => ({ error: 'Invalid or expired verification link' }));
          setMessage(data.error || 'Invalid or expired verification link');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('An error occurred during email verification. Please try again later.');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status === 'loading' && (
            <div className="animate-pulse">
              <div className="h-12 w-12 rounded-full bg-primary/20 mx-auto"></div>
              <h2 className="mt-4 text-xl font-semibold">Verifying your email...</h2>
              <p className="mt-2 text-muted-foreground">Please wait while we verify your email address.</p>
            </div>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="mt-4 text-xl font-semibold">Email Verified!</h2>
              <p className="mt-2 text-muted-foreground">{message}</p>
              <Link 
                href="/auth/login" 
                className="mt-6 inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 rounded-md text-primary-foreground transition-colors"
              >
                Continue to Login <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="mt-4 text-xl font-semibold">Verification Failed</h2>
              <p className="mt-2 text-muted-foreground">{message}</p>
              <div className="mt-6 flex flex-col gap-2">
                <Link 
                  href="/auth/login" 
                  className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 rounded-md text-primary-foreground transition-colors"
                >
                  Return to Login <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center px-4 py-2 bg-secondary hover:bg-secondary/90 rounded-md text-secondary-foreground transition-colors"
                >
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <h2 className="text-2xl font-semibold">Loading...</h2>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
