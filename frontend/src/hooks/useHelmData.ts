/**
 * Helm data hooks with React Query caching
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { helmApi } from '../services/api';

export function useHelmReleases(namespace?: string, allNamespaces = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['helmReleases', namespace, allNamespaces],
    queryFn: async () => {
      const response = await helmApi.listReleases(
        namespace === 'all' ? undefined : namespace,
        namespace === 'all' || allNamespaces
      );
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['helmReleases'] });
  };

  return {
    data: query.data,
    releases: query.data?.releases ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error,
    refresh,
  };
}

export function useHelmRepos() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['helmRepos'],
    queryFn: async () => {
      const response = await helmApi.getRepos();
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,    // 30 minutes
    refetchOnWindowFocus: false,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['helmRepos'] });
  };

  return {
    data: query.data,
    repos: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error,
    refresh,
  };
}

export default useHelmReleases;
