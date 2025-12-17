/**
 * Hooks Index
 * Re-exports all custom hooks
 */

export {
  // Main API hook
  useApi,
  default as useApiDefault,
  // Mutation hook
  useMutation,
  // Polling hook
  usePolling,
  // Async effect hook
  useAsyncEffect,
  // Error handling utilities
  extractErrorMessage,
  // Types
  type ApiState,
  type UseApiOptions,
  type UseApiReturn,
  type UseMutationReturn,
} from './useApi';

// Dashboard data hooks with React Query caching
export { useDashboardData, default as useDashboardDataDefault } from './useDashboardData';
export { useClusterOverviewData, default as useClusterOverviewDataDefault } from './useClusterOverviewData';
export { useSecurityDashboard, default as useSecurityDashboardDefault } from './useSecurityData';
