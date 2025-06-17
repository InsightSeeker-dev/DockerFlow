'use client';
import { Lock, User, Mail, Container, AlertCircle, Eye, EyeOff } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const DockerFlowAuth = () => {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    accountType: 'user'
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Gère les messages d'erreur NextAuth passés via la query string (?error=...)
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      if (error) {
        setErrors(prev => ({ ...prev, auth: decodeURIComponent(error) }));
        // Log côté client pour debug
        console.warn('[NextAuth] error param:', error);
      }
    }
  }, []);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Loading...
          </h2>
        </div>
      </div>
    );
  }

  const clearError = (field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearError(name); // Efface l'erreur quand l'utilisateur commence à modifier le champ
  };

  const handleAccountTypeChange = (type: string) => {
    setFormData(prev => ({
      ...prev,
      accountType: type
    }));
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!isLogin && !formData.name) {
      newErrors.name = 'Name is required';
    }
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setSuccessMessage(null);

    try {
      if (isLogin) {
        // Connexion
        const result = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (result?.error) {
          // Affiche le vrai message d'erreur retourné par NextAuth
          setErrors(prev => ({ ...prev, auth: result.error }));
          // Log côté client pour debug
          console.warn('[NextAuth] login error:', result.error);
        } else {
          // Redirection selon le rôle
          import('./role-redirect').then(async mod => {
            await mod.redirectAfterLogin(router);
          });
        }
      } else {
        // Inscription
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.errors) {
            setErrors(data.errors.reduce((acc: Record<string, string>, curr: { field: string, message: string }) => {
              acc[curr.field] = curr.message;
              return acc;
            }, {}));
          } else {
            setErrors(prev => ({ ...prev, auth: data.error || 'Registration failed' }));
          }
        } else {
          setSuccessMessage('Registration successful! Please check your email to verify your account.');
          // Rediriger vers la page de confirmation
          router.push('/auth/confirmation');
        }
      }
    } catch (error: any) {
      // Log l'erreur pour debug
      console.error('Auth error:', error);
      setErrors(prev => ({ ...prev, auth: error?.message || 'An error occurred. Please try again.' }));
    } finally {
      setIsLoading(false);
    }
  };

  const formVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  const inputVariants = {
    rest: { 
      scale: 1,
      borderColor: "rgba(75, 85, 99, 0.6)"
    },
    focus: { 
      scale: 1.01,
      borderColor: "#3b82f6",
      transition: {
        duration: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-700 via-gray-900 to-black flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-800"
      >
        <div className="p-8">
          <motion.div 
            className="flex items-center justify-center mb-8"
            whileHover={{ scale: 1.05 }}
          >
            <Container className="text-blue-500 mr-3" size={40} />
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
              DockerFlow
            </h1>
          </motion.div>

          <div className="flex mb-8 bg-gray-800/30 rounded-lg p-1">
            {['Login', 'Register'].map((type) => (
              <button
                key={type}
                onClick={() => setIsLogin(type === 'Login')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  (isLogin && type === 'Login') || (!isLogin && type === 'Register')
                    ? 'text-white bg-blue-500/20 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {isLogin ? (
                // Formulaire de connexion
                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      className="pl-10 pr-4 py-3 w-full border border-gray-700/50 rounded-lg bg-gray-800/30 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => clearError('email')}
                      disabled={isLoading}
                    />
                    {errors.email && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1 text-sm text-red-400 flex items-center"
                      >
                        <AlertCircle className="mr-1" size={12} />
                        {errors.email}
                      </motion.p>
                    )}
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Password"
                      className="pl-10 pr-12 py-3 w-full border border-gray-700/50 rounded-lg bg-gray-800/30 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => clearError('password')}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors focus:outline-none"
                    >
                      {showPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                    {errors.password && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1 text-sm text-red-400 flex items-center"
                      >
                        <AlertCircle className="mr-1" size={12} />
                        {errors.password}
                      </motion.p>
                    )}
                  </div>
                </div>
              ) : (
                // Formulaire d'inscription
                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      name="name"
                      placeholder="Name"
                      className="pl-10 pr-4 py-3 w-full border border-gray-700/50 rounded-lg bg-gray-800/30 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                      value={formData.name}
                      onChange={handleChange}
                      onFocus={() => clearError('name')}
                      disabled={isLoading}
                    />
                    {errors.name && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1 text-sm text-red-400 flex items-center"
                      >
                        <AlertCircle className="mr-1" size={12} />
                        {errors.name}
                      </motion.p>
                    )}
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      className="pl-10 pr-4 py-3 w-full border border-gray-700/50 rounded-lg bg-gray-800/30 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => clearError('email')}
                      disabled={isLoading}
                    />
                    {errors.email && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1 text-sm text-red-400 flex items-center"
                      >
                        <AlertCircle className="mr-1" size={12} />
                        {errors.email}
                      </motion.p>
                    )}
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Password"
                      className="pl-10 pr-12 py-3 w-full border border-gray-700/50 rounded-lg bg-gray-800/30 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => clearError('password')}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors focus:outline-none"
                    >
                      {showPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                    {errors.password && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1 text-sm text-red-400 flex items-center"
                      >
                        <AlertCircle className="mr-1" size={12} />
                        {errors.password}
                      </motion.p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Account Type</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handleAccountTypeChange('user')}
                        className={`p-4 rounded-lg border ${
                          formData.accountType === 'user'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-700/50 bg-gray-800/30'
                        } transition-all duration-200 hover:border-blue-500/50`}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <User className={`${
                            formData.accountType === 'user' ? 'text-blue-500' : 'text-gray-400'
                          }`} size={24} />
                          <span className={`text-sm font-medium ${
                            formData.accountType === 'user' ? 'text-blue-500' : 'text-gray-400'
                          }`}>
                            User
                          </span>
                          <span className="text-xs text-gray-500">
                            Basic features
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAccountTypeChange('pro')}
                        className={`p-4 rounded-lg border ${
                          formData.accountType === 'pro'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-700/50 bg-gray-800/30'
                        } transition-all duration-200 hover:border-blue-500/50`}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <Container className={`${
                            formData.accountType === 'pro' ? 'text-blue-500' : 'text-gray-400'
                          }`} size={24} />
                          <span className={`text-sm font-medium ${
                            formData.accountType === 'pro' ? 'text-blue-500' : 'text-gray-400'
                          }`}>
                            Pro
                          </span>
                          <span className="text-xs text-gray-500">
                            Advanced features
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {errors.auth && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <p className="text-sm text-red-400 flex items-center">
                    <AlertCircle className="mr-2" size={16} />
                    {errors.auth}
                  </p>
                </motion.div>
              )}

              {successMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                >
                  <p className="text-sm text-green-400 flex items-center">
                    <AlertCircle className="mr-2" size={16} />
                    {successMessage}
                  </p>
                </motion.div>
              )}

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-all duration-200 ${
                  isLoading
                    ? 'bg-blue-500/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Please wait...
                  </div>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </motion.button>

              {isLogin && (
                <div className="mt-4 text-center">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-gray-400 hover:text-blue-400 transition-colors duration-200"
                  >
                    Forgot your password?
                  </Link>
                </div>
              )}
            </motion.form>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default DockerFlowAuth;