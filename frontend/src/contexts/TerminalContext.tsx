import { createContext, useContext, useState, ReactNode } from 'react';

type TerminalMode = 'kubectl' | 'shell';

interface HistoryEntry {
  type: 'input' | 'output' | 'error' | 'info';
  content: string;
  timestamp: Date;
  executionTime?: number;
  workingDirectory?: string;
}

interface TerminalState {
  mode: TerminalMode;
  history: HistoryEntry[];
  commandHistory: string[];
  workingDirectory: string;
}

interface TerminalContextType {
  state: TerminalState;
  setMode: (mode: TerminalMode) => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  addCommandToHistory: (command: string) => void;
  setWorkingDirectory: (dir: string) => void;
  clearHistory: () => void;
  setHistory: (history: HistoryEntry[]) => void;
}

const defaultState: TerminalState = {
  mode: 'kubectl',
  history: [
    {
      type: 'info',
      content: 'Welcome to NextSight AI Terminal. Use the toggle to switch between kubectl and shell modes.',
      timestamp: new Date(),
    },
    {
      type: 'info',
      content: 'Type "help" for available commands.',
      timestamp: new Date(),
    },
  ],
  commandHistory: [],
  workingDirectory: '~',
};

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TerminalState>(defaultState);

  const setMode = (mode: TerminalMode) => {
    setState(prev => ({ ...prev, mode }));
  };

  const addHistoryEntry = (entry: HistoryEntry) => {
    setState(prev => ({
      ...prev,
      history: [...prev.history, entry],
    }));
  };

  const addCommandToHistory = (command: string) => {
    setState(prev => ({
      ...prev,
      commandHistory: [...prev.commandHistory, command],
    }));
  };

  const setWorkingDirectory = (dir: string) => {
    setState(prev => ({ ...prev, workingDirectory: dir }));
  };

  const clearHistory = () => {
    setState(prev => ({
      ...prev,
      history: [{
        type: 'info',
        content: 'Terminal cleared',
        timestamp: new Date(),
      }],
    }));
  };

  const setHistory = (history: HistoryEntry[]) => {
    setState(prev => ({ ...prev, history }));
  };

  return (
    <TerminalContext.Provider
      value={{
        state,
        setMode,
        addHistoryEntry,
        addCommandToHistory,
        setWorkingDirectory,
        clearHistory,
        setHistory,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (context === undefined) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
