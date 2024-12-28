'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, RefreshCcw, LogIn } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function VerifyErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorMessage = searchParams.error || 'An error occurred during email verification';

  const getErrorContent = () => {
    if (errorMessage.includes('expired')) {
      return {
        title: 'Link Expired',
        description: 'Your verification link has expired. You can request a new one by logging in to your account.',
        icon: <RefreshCcw className="w-16 h-16 text-yellow-500" />,
        buttonText: 'Request New Link',
        buttonIcon: <RefreshCcw className="ml-2 h-5 w-5" />
      };
    }
    if (errorMessage.includes('already verified')) {
      return {
        title: 'Already Verified',
        description: 'Your email is already verified. You can proceed to log in to your account.',
        icon: <LogIn className="w-16 h-16 text-blue-500" />,
        buttonText: 'Log In',
        buttonIcon: <LogIn className="ml-2 h-5 w-5" />
      };
    }
    return {
      title: 'Verification Failed',
      description: 'We encountered an issue while verifying your email. Please try again or contact support.',
      icon: <AlertCircle className="w-16 h-16 text-red-500" />,
      buttonText: 'Return to Login',
      buttonIcon: <ArrowLeft className="ml-2 h-5 w-5" />
    };
  };

  const content = getErrorContent();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <Card className="bg-gray-800 border-gray-700/50 shadow-xl">
          <motion.div 
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-8"
          >
            <div className="text-center">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: 0.4 
                }}
                className="flex justify-center"
              >
                <div className="bg-red-500/10 p-3 rounded-full">
                  {content.icon}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <h2 className="mt-6 text-2xl font-semibold text-gray-200">
                  {content.title}
                </h2>
                <p className="mt-3 text-gray-400">
                  {content.description}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-8 space-y-4"
              >
                <Link href="/auth">
                  <Button
                    size="lg"
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 transform hover:scale-105"
                  >
                    <span>{content.buttonText}</span>
                    {content.buttonIcon}
                  </Button>
                </Link>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-700">
                    <p className="text-sm text-gray-300">
                      <span className="font-medium">Need help?</span> If you're experiencing issues,
                      please contact our support team.
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}
