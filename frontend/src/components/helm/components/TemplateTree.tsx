import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderIcon,
  DocumentIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import type { TemplateFile } from './types';

interface TemplateTreeProps {
  files: TemplateFile[];
  selectedFile: string | null;
  onSelectFile: (name: string) => void;
  level?: number;
}

export function TemplateTree({
  files,
  selectedFile,
  onSelectFile,
  level = 0,
}: TemplateTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['templates']));

  const toggleFolder = (name: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div className="space-y-0.5">
      {files.map((file) => (
        <div key={file.name}>
          <motion.button
            whileHover={{ x: 2 }}
            onClick={() => {
              if (file.type === 'folder') {
                toggleFolder(file.name);
              } else {
                onSelectFile(file.name);
              }
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
              selectedFile === file.name
                ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                : 'hover:bg-gray-100 dark:hover:bg-slate-700/50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            {file.type === 'folder' ? (
              <>
                {expandedFolders.has(file.name) ? (
                  <ChevronDownIcon className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                )}
                <FolderIcon className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </>
            ) : (
              <>
                <span className="w-3" />
                <DocumentIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              </>
            )}
            <span className="text-xs truncate">{file.name}</span>
          </motion.button>
          {file.type === 'folder' && expandedFolders.has(file.name) && file.children && (
            <TemplateTree
              files={file.children}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}
