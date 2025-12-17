// Helm Types

export type HelmReleaseStatus = 'deployed' | 'failed' | 'pending-install' | 'pending-upgrade' | 'pending-rollback' | 'uninstalling' | 'superseded' | 'unknown';

export interface HelmRelease {
  name: string;
  namespace: string;
  revision: number;
  status: HelmReleaseStatus;
  chart: string;
  chart_version: string;
  app_version?: string;
  updated?: string;
  description?: string;
}

export interface HelmReleaseHistory {
  revision: number;
  status: HelmReleaseStatus;
  chart: string;
  chart_version: string;
  app_version?: string;
  updated: string;
  description?: string;
}

export interface HelmReleaseValues {
  user_supplied: Record<string, unknown>;
  computed: Record<string, unknown>;
}

export interface HelmRepository {
  name: string;
  url: string;
  is_default?: boolean;
}

export interface HelmChartInfo {
  name: string;
  version: string;
  app_version?: string;
  description?: string;
  repository?: string;
  icon?: string;
  home?: string;
  sources: string[];
  keywords: string[];
  maintainers: Array<{ name?: string; email?: string; url?: string }>;
}

export interface HelmChartSearchResult {
  name: string;
  version: string;
  app_version?: string;
  description?: string;
  repository: string;
}

export interface HelmInstallRequest {
  release_name: string;
  chart: string;
  namespace?: string;
  version?: string;
  values?: Record<string, unknown>;
  create_namespace?: boolean;
  wait?: boolean;
  timeout?: number;
  dry_run?: boolean;
  repository?: string;
}

export interface HelmUpgradeRequest {
  chart?: string;
  version?: string;
  values?: Record<string, unknown>;
  reset_values?: boolean;
  reuse_values?: boolean;
  wait?: boolean;
  timeout?: number;
  dry_run?: boolean;
  force?: boolean;
  repository?: string;
}

export interface HelmOperationResult {
  success: boolean;
  message: string;
  release?: HelmRelease;
  manifest?: string;
  notes?: string;
}

export interface HelmReleaseListResponse {
  releases: HelmRelease[];
  total: number;
}

export interface HelmRepositoryListResponse {
  repositories: HelmRepository[];
}
