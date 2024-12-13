'use client';

import { Mail } from 'lucide-react';
import Link from 'next/link';

export default function VerifyRequest() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center">
          <Mail className="h-12 w-12 text-blue-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-200">Check your email</h2>
          <p className="mt-2 text-gray-400">
            A verification link has been sent to your email address.
            Please click the link to verify your account.
          </p>
          <div className="mt-6 space-y-4">
            <p className="text-sm text-gray-400">
              Didn&apos;t receive the email? Check your spam folder or
              <Link href="/auth" className="text-blue-500 hover:text-blue-400 ml-1">
                try another email address
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
