/**
 * Nodes data hook with React Query caching
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kubernetesApi } from '../services/api';
import { prometheusApi } from '../services/prometheusApi';
import type { NodeInfo, NodeMetrics, Pod } from '../types';

interface NodePrometheusMetrics {
  nodeName: string;
  cpuPercent: number;
  memoryPercent: number;
  cpuHistory: number[];
  memoryHistory: number[];
}

interface NodePodData {
  count: number;
  pods: Pod[];
}

interface NodesData {
  nodes: NodeInfo[];
  metrics: NodeMetrics[];
  prometheusAvailable: boolean;
  nodePrometheusMetrics: Record<string, NodePrometheusMetrics>;
  nodePods: Record<string, NodePodData>;
}

const NODES_QUERY_KEY = ['nodes', 'combined'];

async function fetchNodesData(): Promise<NodesData> {
  // Check Prometheus status
  const promStatus = await prometheusApi.getStackStatus().catch(() => null);
  const prometheusAvailable = promStatus?.data?.status === 'running';

  const [nodesRes, metricsRes, podsRes] = await Promise.all([
    kubernetesApi.getNodes().catch(() => ({ data: [] })),
    kubernetesApi.getNodeMetrics().catch(() => ({ data: [] })),
    kubernetesApi.getPods().catch(() => ({ data: [] })),
  ]);

  // Group pods by node
  const nodePods: Record<string, NodePodData> = {};
  (podsRes.data || []).forEach((pod: Pod) => {
    const nodeName = pod.node || 'unknown';
    if (!nodePods[nodeName]) {
      nodePods[nodeName] = { count: 0, pods: [] };
    }
    nodePods[nodeName].count++;
    nodePods[nodeName].pods.push(pod);
  });

  let nodePrometheusMetrics: Record<string, NodePrometheusMetrics> = {};

  // Fetch per-node metrics from Prometheus if available
  if (prometheusAvailable && nodesRes.data.length > 0) {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const [cpuRes, memRes] = await Promise.all([
      prometheusApi.queryRange({
        query: '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)',
        start: fiveMinAgo.toISOString(),
        end: now.toISOString(),
        step: '30s',
      }).catch(() => null),
      prometheusApi.queryRange({
        query: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
        start: fiveMinAgo.toISOString(),
        end: now.toISOString(),
        step: '30s',
      }).catch(() => null),
    ]);

    // Process CPU metrics
    if (cpuRes?.data?.result) {
      cpuRes.data.result.forEach((result: { metric: { instance: string }; values: Array<{ value: string }> }) => {
        const instance = result.metric?.instance || '';
        const nodeName = instance.split(':')[0];

        if (!nodePrometheusMetrics[nodeName]) {
          nodePrometheusMetrics[nodeName] = {
            nodeName,
            cpuPercent: 0,
            memoryPercent: 0,
            cpuHistory: [],
            memoryHistory: [],
          };
        }

        const values = result.values.map((v: { value: string }) => Math.round(parseFloat(v.value)));
        nodePrometheusMetrics[nodeName].cpuHistory = values.slice(-10);
        nodePrometheusMetrics[nodeName].cpuPercent = values[values.length - 1] || 0;
      });
    }

    // Process Memory metrics
    if (memRes?.data?.result) {
      memRes.data.result.forEach((result: { metric: { instance: string }; values: Array<{ value: string }> }) => {
        const instance = result.metric?.instance || '';
        const nodeName = instance.split(':')[0];

        if (!nodePrometheusMetrics[nodeName]) {
          nodePrometheusMetrics[nodeName] = {
            nodeName,
            cpuPercent: 0,
            memoryPercent: 0,
            cpuHistory: [],
            memoryHistory: [],
          };
        }

        const values = result.values.map((v: { value: string }) => Math.round(parseFloat(v.value)));
        nodePrometheusMetrics[nodeName].memoryHistory = values.slice(-10);
        nodePrometheusMetrics[nodeName].memoryPercent = values[values.length - 1] || 0;
      });
    }
  }

  return {
    nodes: nodesRes.data,
    metrics: metricsRes.data,
    prometheusAvailable,
    nodePrometheusMetrics,
    nodePods,
  };
}

export function useNodesData() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NODES_QUERY_KEY,
    queryFn: fetchNodesData,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: NODES_QUERY_KEY });
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error,
    refresh,
  };
}

export default useNodesData;
