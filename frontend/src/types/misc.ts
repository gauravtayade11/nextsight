// Miscellaneous Types - Incidents, Timeline, GitFlow, Self-Service, Jenkins, AI

// Incident types
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source?: string;
  namespace?: string;
  affected_services: string[];
  ai_analysis?: string;
  ai_recommendations: string[];
  assigned_to?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface IncidentAnalysis {
  incident_id: string;
  analysis: string;
  root_cause_hypothesis?: string;
  recommendations: string[];
  related_events: Array<{ event: string; relevance: string }>;
  confidence_score: number;
}

// Timeline types
export type ChangeType = 'deployment' | 'config_change' | 'scale_event' | 'build' | 'incident' | 'rollback' | 'feature_flag' | 'infrastructure';
export type ChangeSource = 'kubernetes' | 'jenkins' | 'manual' | 'github' | 'terraform';

export interface TimelineEvent {
  id: string;
  event_type: ChangeType;
  source: ChangeSource;
  title: string;
  description?: string;
  namespace?: string;
  service_name?: string;
  environment?: string;
  user?: string;
  metadata: Record<string, unknown>;
  event_timestamp: string;
  related_incident_id?: string;
  created_at: string;
}

// GitFlow types
export type ReleaseStatus = 'draft' | 'pending_approval' | 'approved' | 'deploying' | 'deployed' | 'rolled_back' | 'failed';
export type Environment = 'development' | 'staging' | 'uat' | 'production';

export interface Release {
  id: string;
  version: string;
  release_branch: string;
  source_branch: string;
  target_branch: string;
  status: ReleaseStatus;
  commits: Array<{ sha: string; message: string; author: string; date: string }>;
  changelog?: string;
  created_by?: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

export interface DeploymentStatus {
  id: string;
  release_id: string;
  environment: Environment;
  namespace: string;
  status: string;
  services: Array<Record<string, unknown>>;
  started_at: string;
  completed_at?: string;
  deployed_by?: string;
  rollback_available: boolean;
  previous_version?: string;
}

// Self-Service types
export type ActionType = 'deploy' | 'rollback' | 'scale' | 'restart' | 'build' | 'config_update';
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed';

export interface SelfServiceAction {
  id: string;
  action_type: ActionType;
  target_service: string;
  target_namespace: string;
  target_environment: string;
  parameters: Record<string, unknown>;
  reason: string;
  status: ActionStatus;
  requested_by: string;
  approved_by?: string;
  executed_at?: string;
  result?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
}

export interface ServiceCatalogItem {
  name: string;
  namespace: string;
  environment: string;
  description?: string;
  owner_team?: string;
  current_version?: string;
  allowed_actions: ActionType[];
  health_status: string;
  last_deployed?: string;
}

// Jenkins types
export interface JenkinsJob {
  name: string;
  url: string;
  color: string;
  buildable: boolean;
  last_build_number?: number;
  last_successful_build?: number;
  last_failed_build?: number;
  health_score: number;
  description?: string;
}

export interface JenkinsBuild {
  number: number;
  url: string;
  result?: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'BUILDING';
  building: boolean;
  duration: number;
  timestamp: string;
  display_name: string;
  triggered_by?: string;
}

// AI Chat types
export interface ChatRequest {
  message: string;
  context?: string;
}

export interface ChatResponse {
  response: string;
  success: boolean;
}

// Proactive Insights types
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low';
export type InsightCategory = 'reliability' | 'security' | 'performance' | 'cost' | 'efficiency';

export interface ProactiveInsight {
  id: string;
  severity: InsightSeverity;
  category: InsightCategory;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  auto_fixable: boolean;
  created_at: string;
}

export interface ProactiveInsightsResponse {
  insights: ProactiveInsight[];
  cluster_health_score: number;
  total_issues: number;
  critical_count: number;
  high_count: number;
  last_analyzed: string;
  success: boolean;
}
