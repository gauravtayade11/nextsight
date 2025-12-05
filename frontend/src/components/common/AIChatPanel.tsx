import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  ArrowPathIcon,
  MinusIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  onClose?: () => void;
}

const quickActions = [
  { icon: ShieldCheckIcon, label: 'Security', prompt: 'Run a security scan on my cluster' },
  { icon: CpuChipIcon, label: 'Resources', prompt: 'Show me current resource usage' },
  { icon: CommandLineIcon, label: 'Deploys', prompt: 'What is the status of recent deployments?' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AIChatPanel({ onClose }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your NextSight AI assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
    // Check AI health on mount
    checkAIHealth();
  }, []);

  const checkAIHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/health`);
      const data = await response.json();
      setAiAvailable(data.status === 'available');
    } catch {
      setAiAvailable(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting to the AI service. Please check that the backend is running and GEMINI_API_KEY is configured.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  // Minimized view
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed right-4 bottom-4 z-50"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-slate-700/50"
        >
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500">
            <SparklesIcon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">NextSight AI</span>
          <ArrowsPointingOutIcon className="h-4 w-4 text-gray-400" />
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed right-4 bottom-4 w-80 h-[420px] z-50 flex flex-col"
    >
      <div className="flex-1 flex flex-col bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100/50 dark:border-slate-700/50 bg-gradient-to-r from-primary-500/10 to-purple-500/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 shadow-md shadow-primary-500/20">
              <SparklesIcon className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">NextSight AI</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${aiAvailable ? 'bg-success-500' : aiAvailable === false ? 'bg-danger-500' : 'bg-gray-400'}`} />
                {aiAvailable ? 'Online' : aiAvailable === false ? 'Offline' : 'Checking...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <MinusIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <XMarkIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </motion.button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white'
                      : 'bg-gray-100/80 dark:bg-slate-700/80 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <p className={`text-[9px] mt-1 ${message.role === 'user' ? 'text-primary-200' : 'text-gray-400 dark:text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-gray-100/80 dark:bg-slate-700/80 rounded-xl px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <ArrowPathIcon className="h-3 w-3 animate-spin text-primary-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Thinking...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="px-3 py-2 border-t border-gray-100/50 dark:border-slate-700/50">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">Quick actions:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickActions.map((action, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100/80 dark:bg-slate-700/50 text-[10px] text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  <action.icon className="h-3 w-3" />
                  {action.label}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100/50 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 px-3 py-2 rounded-xl bg-gray-100/80 dark:bg-slate-700/50 border border-gray-200/50 dark:border-slate-600/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-xs"
              disabled={isLoading}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
            </motion.button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

// Floating trigger button component
export function AIChatTrigger({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="fixed right-4 bottom-4 p-3 rounded-xl bg-gradient-to-r from-primary-500 to-purple-500 text-white shadow-lg shadow-primary-500/25 z-50"
    >
      <ChatBubbleLeftRightIcon className="h-5 w-5" />
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-success-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse" />
    </motion.button>
  );
}
