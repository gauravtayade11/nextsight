import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { kubernetesApi } from '../services/api';

interface NamespaceContextType {
  namespaces: string[];
  selectedNamespace: string; // empty string means "All Namespaces"
  loading: boolean;
  error: string | null;
  setSelectedNamespace: (namespace: string) => void;
  refreshNamespaces: () => Promise<void>;
}

const NamespaceContext = createContext<NamespaceContextType | undefined>(undefined);

export function NamespaceProvider({ children }: { children: ReactNode }) {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespaceState] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNamespaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await kubernetesApi.getNamespaces();
      const nsNames = response.data.map((ns: { name: string }) => ns.name);
      setNamespaces(nsNames);
    } catch (err) {
      console.error('Failed to fetch namespaces:', err);
      setError('Failed to load namespaces');
      // Fallback to basic namespaces
      setNamespaces(['default', 'kube-system']);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  const setSelectedNamespace = useCallback((namespace: string) => {
    setSelectedNamespaceState(namespace);
  }, []);

  const refreshNamespaces = useCallback(async () => {
    await fetchNamespaces();
  }, [fetchNamespaces]);

  return (
    <NamespaceContext.Provider value={{
      namespaces,
      selectedNamespace,
      loading,
      error,
      setSelectedNamespace,
      refreshNamespaces
    }}>
      {children}
    </NamespaceContext.Provider>
  );
}

export function useNamespace() {
  const context = useContext(NamespaceContext);
  if (context === undefined) {
    throw new Error('useNamespace must be used within a NamespaceProvider');
  }
  return context;
}
