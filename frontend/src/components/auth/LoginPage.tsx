import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../utils/axios';
import {
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ServerStackIcon,
  CloudIcon,
  ChartBarIcon,
  CommandLineIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

// Import shared animation variants
import { slideUpVariants, scaleVariants, itemVariants } from '../../utils/constants';

// OAuth provider icons
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
  </svg>
);

const GitLabIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#E24329" d="M12 21.35l3.19-9.81H8.81z"/>
    <path fill="#FC6D26" d="M12 21.35l-3.19-9.81H2.29z"/>
    <path fill="#FCA326" d="M2.29 11.54l-.95 2.93c-.09.27 0 .57.23.73L12 21.35z"/>
    <path fill="#E24329" d="M2.29 11.54h6.52L5.95 2.67c-.1-.3-.52-.3-.62 0z"/>
    <path fill="#FC6D26" d="M12 21.35l3.19-9.81h6.52z"/>
    <path fill="#FCA326" d="M21.71 11.54l.95 2.93c.09.27 0 .57-.23.73L12 21.35z"/>
    <path fill="#E24329" d="M21.71 11.54h-6.52l2.86-8.87c.1-.3.52-.3.62 0z"/>
  </svg>
);

interface OAuthProvider {
  name: string;
  key: string;
}

// Typewriter effect component
function TypewriterText({ texts, className = '' }: { texts: string[]; className?: string }) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const text = texts[currentTextIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (currentText.length < text.length) {
          setCurrentText(text.slice(0, currentText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (currentText.length > 0) {
          setCurrentText(text.slice(0, currentText.length - 1));
        } else {
          setIsDeleting(false);
          setCurrentTextIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? 50 : 100);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentTextIndex, texts]);

  return (
    <span className={className}>
      {currentText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-0.5 h-8 bg-cyan-400 ml-1 align-middle"
      />
    </span>
  );
}

// Floating particle component
function FloatingParticle({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 bg-cyan-400 rounded-full opacity-60"
      initial={{
        x: Math.random() * 100 + '%',
        y: '100%',
        opacity: 0
      }}
      animate={{
        y: '-100%',
        opacity: [0, 0.6, 0.6, 0],
      }}
      transition={{
        duration: 8 + Math.random() * 4,
        delay: delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// Neural network node
function NeuralNode({ x, y, delay = 0 }: { x: string; y: string; delay?: number }) {
  return (
    <motion.div
      className="absolute w-2 h-2 bg-cyan-500 rounded-full"
      style={{ left: x, top: y }}
      animate={{
        scale: [1, 1.5, 1],
        opacity: [0.3, 0.8, 0.3],
        boxShadow: [
          '0 0 10px rgba(6, 182, 212, 0.3)',
          '0 0 25px rgba(6, 182, 212, 0.6)',
          '0 0 10px rgba(6, 182, 212, 0.3)',
        ],
      }}
      transition={{
        duration: 2,
        delay: delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [oauthProviders, setOAuthProviders] = useState<OAuthProvider[]>([]);
  const [oauthLoading, setOAuthLoading] = useState<string | null>(null);

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // Load remembered username and fetch OAuth providers
  useEffect(() => {
    const remembered = localStorage.getItem('nextsight_remember_user');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }

    // Fetch OAuth providers
    api.get('/auth/oauth/providers')
      .then((res) => {
        if (res.data.enabled && res.data.providers) {
          setOAuthProviders(res.data.providers);
        }
      })
      .catch(() => {
        // OAuth not available, that's fine
      });
  }, []);

  const handleOAuthLogin = async (provider: string) => {
    setOAuthLoading(provider);
    setError(null);

    try {
      const res = await api.get(`/auth/oauth/${provider}/authorize`);
      if (res.data.authorization_url) {
        // Redirect to OAuth provider
        window.location.href = res.data.authorization_url;
      }
    } catch (err) {
      setError(`Failed to initiate ${provider} login`);
      setOAuthLoading(null);
    }
  };

  const getOAuthIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google': return <GoogleIcon />;
      case 'github': return <GitHubIcon />;
      case 'gitlab': return <GitLabIcon />;
      default: return null;
    }
  };

  const getOAuthButtonStyle = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300';
      case 'github':
        return 'bg-slate-800 hover:bg-slate-700 text-white';
      case 'gitlab':
        return 'bg-[#FC6D26] hover:bg-[#E24329] text-white';
      default:
        return 'bg-slate-700 hover:bg-slate-600 text-white';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      if (rememberMe) {
        localStorage.setItem('nextsight_remember_user', username);
      } else {
        localStorage.removeItem('nextsight_remember_user');
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const typewriterTexts = [
    'Infrastructure Differently',
    'Clusters Intelligently',
    'Security Proactively',
    'Deployments Seamlessly',
    'Costs Efficiently',
  ];

  const features = [
    { icon: CpuChipIcon, title: 'AI Insights', gradient: 'from-cyan-500 to-blue-500' },
    { icon: ServerStackIcon, title: 'Multi-Cluster', gradient: 'from-purple-500 to-pink-500' },
    { icon: ShieldCheckIcon, title: 'Security', gradient: 'from-green-500 to-emerald-500' },
    { icon: CloudIcon, title: 'GitOps', gradient: 'from-orange-500 to-red-500' },
    { icon: ChartBarIcon, title: 'Cost Analytics', gradient: 'from-yellow-500 to-amber-500' },
    { icon: CommandLineIcon, title: 'Terminal', gradient: 'from-indigo-500 to-violet-500' },
  ];

  return (
    <div className="min-h-screen flex bg-slate-950 overflow-hidden">
      {/* Left Side - Dark AI Theme */}
      <div className="hidden lg:flex lg:w-[55%] relative">
        {/* Deep space background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full filter blur-[100px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full filter blur-[100px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/15 rounded-full filter blur-[80px]"
          animate={{
            x: ['-50%', '-40%', '-50%'],
            y: ['-50%', '-60%', '-50%'],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <FloatingParticle key={i} delay={i * 0.5} />
          ))}
        </div>

        {/* Neural network nodes */}
        <div className="absolute inset-0">
          <NeuralNode x="20%" y="30%" delay={0} />
          <NeuralNode x="70%" y="20%" delay={0.5} />
          <NeuralNode x="40%" y="60%" delay={1} />
          <NeuralNode x="80%" y="50%" delay={1.5} />
          <NeuralNode x="30%" y="80%" delay={2} />
          <NeuralNode x="60%" y="75%" delay={2.5} />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 w-full">
          {/* Logo with glow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <div className="flex items-center space-x-4">
              <motion.div
                className="relative"
                whileHover={{ scale: 1.05 }}
              >
                <div className="absolute inset-0 bg-cyan-500 rounded-2xl blur-xl opacity-50" />
                <div className="relative w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl">
                  <SparklesIcon className="w-8 h-8 text-white" />
                </div>
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  NextSight <span className="text-cyan-400">AI</span>
                </h1>
                <p className="text-slate-400 text-sm font-medium">
                  Intelligent DevOps Platform
                </p>
              </div>
            </div>
          </motion.div>

          {/* Typewriter Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-10"
          >
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
              <span className="text-white">See Your</span>
              <br />
              <TypewriterText
                texts={typewriterTexts}
                className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"
              />
            </h2>
            <p className="text-slate-400 text-base max-w-lg leading-relaxed mb-4">
              The intelligent DevOps platform that transforms how you manage infrastructure.
              Powered by AI to detect anomalies, predict issues, and optimize performance.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 text-xs rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Kubernetes Native
              </span>
              <span className="px-3 py-1 text-xs rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Role-Based Access
              </span>
              <span className="px-3 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Enterprise Ready
              </span>
            </div>
          </motion.div>

          {/* Features Grid - Compact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap gap-2"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 cursor-pointer transition-all flex items-center gap-2"
              >
                <div className={`w-6 h-6 rounded bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}>
                  <feature.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-white text-xs font-medium">{feature.title}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Version Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="mt-10"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              v1.4.0 — AI Enhanced
            </span>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Login Form (Dark) */}
      <div className="flex-1 flex items-center justify-center bg-slate-900 px-4 sm:px-6 lg:px-8 relative">
        {/* Subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800" />

        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md space-y-8 relative z-10"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center space-x-3"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <SparklesIcon className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-white">
                  NextSight <span className="text-cyan-400">AI</span>
                </h1>
                <p className="text-xs text-slate-400">Intelligent DevOps Platform</p>
              </div>
            </motion.div>
          </div>

          {/* Welcome Text */}
          <div className="text-center lg:text-left">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-bold text-white"
            >
              Welcome back
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-2 text-slate-400"
            >
              Sign in to access your AI-powered dashboard
            </motion.p>
          </div>

          {/* Login Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
            onSubmit={handleSubmit}
          >
            {/* Error Alert */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="rounded-xl bg-red-500/10 border border-red-500/30 p-4"
                >
                  <div className="flex items-center">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                    <p className="ml-3 text-sm font-medium text-red-300">
                      {error}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <motion.div
                animate={{
                  boxShadow: focusedField === 'username'
                    ? '0 0 0 2px rgba(6, 182, 212, 0.3)'
                    : '0 0 0 0px rgba(6, 182, 212, 0)',
                }}
                className="relative rounded-xl"
              >
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="block w-full px-4 py-3.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:bg-slate-800 transition-all duration-300"
                  placeholder="Enter your username"
                />
              </motion.div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <motion.div
                animate={{
                  boxShadow: focusedField === 'password'
                    ? '0 0 0 2px rgba(6, 182, 212, 0.3)'
                    : '0 0 0 0px rgba(6, 182, 212, 0)',
                }}
                className="relative rounded-xl"
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="block w-full px-4 py-3.5 pr-12 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:bg-slate-800 transition-all duration-300"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </motion.div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900 cursor-pointer"
                />
                <span className="ml-2 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  Remember me
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full relative overflow-hidden py-4 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-cyan-500/25"
            >
              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              />

              <span className="relative flex items-center justify-center">
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <LockClosedIcon className="w-5 h-5 mr-2" />
                    Sign In
                  </>
                )}
              </span>
            </motion.button>

            {/* OAuth Providers */}
            {oauthProviders.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6"
              >
                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-slate-900 px-4 text-slate-500">or continue with</span>
                  </div>
                </div>

                {/* OAuth Buttons */}
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {oauthProviders.map((provider) => (
                    <motion.button
                      key={provider.key}
                      type="button"
                      onClick={() => handleOAuthLogin(provider.key)}
                      disabled={oauthLoading !== null}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center justify-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${getOAuthButtonStyle(provider.key)} ${oauthLoading === provider.key ? 'opacity-70' : ''}`}
                    >
                      {oauthLoading === provider.key ? (
                        <svg
                          className="animate-spin h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        getOAuthIcon(provider.key)
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.form>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <p className="text-xs text-slate-500">
              Secured with <span className="text-slate-400">enterprise-grade encryption</span>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
