'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmail() {
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
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message);
        } else {
          setStatus('error');
          setMessage(data.error);
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred during email verification');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status === 'loading' && (
            <div className="animate-pulse">
              <div className="h-12 w-12 rounded-full bg-blue-500/20 mx-auto"></div>
              <h2 className="mt-4 text-xl font-semibold text-gray-200">Verifying your email...</h2>
            </div>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="mt-4 text-xl font-semibold text-gray-200">Email Verified!</h2>
              <p className="mt-2 text-gray-400">{message}</p>
              <Link 
                href="/auth" 
                className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors"
              >
                Continue to Login <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-red-500 mx-auto" />
              <h2 className="mt-4 text-xl font-semibold text-gray-200">Verification Failed</h2>
              <p className="mt-2 text-gray-400">{message}</p>
              <Link 
                href="/auth" 
                className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors"
              >
                Return to Login <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
