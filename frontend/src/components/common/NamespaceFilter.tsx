import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderIcon, ChevronDownIcon, CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useNamespace } from '../../contexts/NamespaceContext';

export default function NamespaceFilter() {
  const { namespaces, selectedNamespace, loading, setSelectedNamespace } = useNamespace();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Display value for the button
  const displayValue = selectedNamespace || 'All Namespaces';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Include "All Namespaces" option at the beginning
  const allNamespaces = ['All Namespaces', ...namespaces];

  const filteredNamespaces = allNamespaces.filter(ns =>
    ns.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (namespace: string) => {
    // Convert "All Namespaces" to empty string for API calls
    const nsValue = namespace === 'All Namespaces' ? '' : namespace;
    setSelectedNamespace(nsValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200/50 dark:border-slate-700/50 hover:bg-gray-200/80 dark:hover:bg-slate-700/80 transition-colors w-full"
      >
        <FolderIcon className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
          {loading ? 'Loading...' : displayValue}
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ml-auto ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200/50 dark:border-slate-700/50 overflow-hidden z-50"
          >
            {/* Search */}
            <div className="p-2 border-b border-gray-100 dark:border-slate-700">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search namespaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 border-0 focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white placeholder-gray-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Namespace List */}
            <div className="max-h-64 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
                </div>
              ) : filteredNamespaces.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No namespaces found
                </p>
              ) : (
                filteredNamespaces.map((namespace) => {
                  const isSelected = namespace === 'All Namespaces'
                    ? selectedNamespace === ''
                    : namespace === selectedNamespace;

                  return (
                    <button
                      key={namespace}
                      onClick={() => handleSelect(namespace)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FolderIcon className={`h-4 w-4 ${
                          isSelected ? 'text-purple-500' : 'text-gray-400'
                        }`} />
                        <span className={namespace === 'All Namespaces' ? 'font-medium' : ''}>
                          {namespace}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckIcon className="h-4 w-4 text-purple-500" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
