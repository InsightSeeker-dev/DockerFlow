'use client';

import { Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function VerifyRequest() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700/50"
        >
          <div className="text-center">
            <div className="flex justify-center">
              <div className="bg-blue-500/10 p-3 rounded-full">
                <Mail className="h-12 w-12 text-blue-500" />
              </div>
            </div>
            
            <h2 className="mt-6 text-2xl font-semibold text-gray-200">Check your email</h2>
            <p className="mt-3 text-gray-400">
              A verification link has been sent to your email address.
              Please click the link to verify your account.
            </p>

            <div className="mt-8 space-y-4">
              <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-700">
                <p className="text-sm text-gray-300">
                  <span className="font-medium">Tip:</span> If you don't see the email in your inbox, 
                  please check your spam folder.
                </p>
              </div>

              <Link 
                href="/auth" 
                className="inline-flex items-center text-sm text-gray-400 hover:text-blue-400 transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
