/**
 * Events data hook with React Query caching
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kubernetesApi } from '../services/api';

export function useEvents(namespace?: string, limit?: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['events', namespace, limit],
    queryFn: async () => {
      const response = await kubernetesApi.getEvents(namespace, limit);
      return response.data;
    },
    staleTime: 15 * 1000,  // 15 seconds (events change frequently)
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['events', namespace, limit] });
  };

  return {
    data: query.data,
    events: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error,
    refresh,
  };
}

export default useEvents;
