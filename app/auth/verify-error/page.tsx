'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, RefreshCcw, LogIn } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function VerifyErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const router = useRouter();
  const errorMessage = searchParams.error || 'Une erreur est survenue lors de la vérification';

  useEffect(() => {
    // Redirection automatique après 10 secondes
    const timer = setTimeout(() => {
      router.push('/auth/login');
    }, 10000);

    return () => clearTimeout(timer);
  }, [router]);

  const getErrorContent = () => {
    if (errorMessage.includes('expired')) {
      return {
        title: 'Lien expiré',
        description: 'Votre lien de vérification a expiré. Vous pouvez en demander un nouveau en vous connectant à votre compte.',
        icon: <RefreshCcw className="w-16 h-16 text-yellow-500" />,
        buttonText: 'Demander un nouveau lien',
        buttonIcon: <RefreshCcw className="ml-2 h-5 w-5" />,
        link: '/auth/request-verification'
      };
    }
    if (errorMessage.includes('already verified')) {
      return {
        title: 'Déjà vérifié',
        description: 'Votre email est déjà vérifié. Vous pouvez vous connecter à votre compte.',
        icon: <LogIn className="w-16 h-16 text-blue-500" />,
        buttonText: 'Se connecter',
        buttonIcon: <LogIn className="ml-2 h-5 w-5" />,
        link: '/auth/login'
      };
    }
    return {
      title: 'Échec de la vérification',
      description: 'Nous avons rencontré un problème lors de la vérification de votre email. Veuillez réessayer ou contacter le support.',
      icon: <AlertCircle className="w-16 h-16 text-red-500" />,
      buttonText: 'Retour à la connexion',
      buttonIcon: <ArrowLeft className="ml-2 h-5 w-5" />,
      link: '/auth/login'
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
            className="p-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.3 }}
              className="mx-auto w-16 h-16 mb-4"
            >
              {content.icon}
            </motion.div>
            
            <h2 className="text-2xl font-bold text-white mb-2">{content.title}</h2>
            <p className="text-gray-400 mb-6">
              {content.description}
              <br />
              <span className="text-sm mt-2 block">
                Vous serez redirigé vers la page de connexion dans quelques secondes...
              </span>
            </p>

            <Link href={content.link}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {content.buttonText}
                {content.buttonIcon}
              </Button>
            </Link>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}
