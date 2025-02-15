import React, { useState } from 'react';
import { Lock, User, Mail, Container, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FormData {
  email: string;
  password: string;
  username?: string;
}

interface FormErrors {
  [key: string]: string;
}

const DockerFlowAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    username: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
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
    if (!isLogin && !formData.username) {
      newErrors.username = 'Username is required';
    }
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newErrors = validateForm();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(isLogin ? 'Login' : 'Register', formData);
      // Add your authentication logic here
    } catch (error) {
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const formVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="px-8 pt-6 pb-4 bg-gray-700">
          <motion.div 
            className="flex items-center justify-center mb-4"
            whileHover={{ scale: 1.05 }}
          >
            <Container className="text-blue-400 mr-3" size={48} />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              DockerFlow
            </h1>
          </motion.div>
          <div className="flex border-b border-gray-600 mb-6">
            {['Login', 'Register'].map((type) => (
              <button
                key={type}
                onClick={() => setIsLogin(type === 'Login')}
                className={`w-1/2 py-3 text-lg font-semibold relative ${
                  (isLogin && type === 'Login') || (!isLogin && type === 'Register')
                    ? 'text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {type}
                {((isLogin && type === 'Login') || (!isLogin && type === 'Register')) && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={isLogin ? 'login' : 'register'}
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onSubmit={handleSubmit}
            className="px-8 pt-6 pb-8"
          >
            {!isLogin && (
              <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="username">
                  <User className="inline-block mr-2 mb-1" size={20} />
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 text-gray-200 border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                    errors.username ? 'border-red-500' : ''
                  }`}
                  placeholder="Choose a username"
                />
                {errors.username && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-xs mt-1 flex items-center"
                  >
                    <AlertCircle size={16} className="mr-1" />
                    {errors.username}
                  </motion.p>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="email">
                <Mail className="inline-block mr-2 mb-1" size={20} />
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 text-gray-200 border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                  errors.email ? 'border-red-500' : ''
                }`}
                placeholder="Enter your email"
              />
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-500 text-xs mt-1 flex items-center"
                >
                  <AlertCircle size={16} className="mr-1" />
                  {errors.email}
                </motion.p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="password">
                <Lock className="inline-block mr-2 mb-1" size={20} />
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 text-gray-200 border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                  errors.password ? 'border-red-500' : ''
                }`}
                placeholder="Enter your password"
              />
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-500 text-xs mt-1 flex items-center"
                >
                  <AlertCircle size={16} className="mr-1" />
                  {errors.password}
                </motion.p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 ${
                  isLoading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </motion.button>
            </div>

            {isLogin && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center mt-4"
              >
                <a
                  href="#"
                  className="text-sm text-blue-400 hover:text-blue-300 transition duration-300"
                >
                  Forgot Password?
                </a>
              </motion.div>
            )}

            {errors.submit && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded text-red-500 text-sm"
              >
                {errors.submit}
              </motion.div>
            )}
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default DockerFlowAuth;
