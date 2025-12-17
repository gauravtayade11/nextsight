import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { TerminalProvider } from './contexts/TerminalContext';
import { ClusterProvider } from './contexts/ClusterContext';
import { NamespaceProvider } from './contexts/NamespaceContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
import DualSidebarLayout from './components/common/DualSidebarLayout';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const NodesView = lazy(() => import('./components/kubernetes/NodesView'));
const ClusterMetrics = lazy(() => import('./components/kubernetes/ClusterMetrics'));
const KubernetesResourcesView = lazy(() => import('./components/kubernetes/KubernetesResourcesView'));
const KubectlTerminal = lazy(() => import('./components/kubernetes/KubectlTerminal'));
const YAMLDeployEnhanced = lazy(() => import('./components/deploy/YAMLDeployEnhanced'));
const HelmDeploy = lazy(() => import('./components/deploy/HelmDeploy'));
const HelmDashboard = lazy(() => import('./components/helm/HelmDashboard'));
const HelmChartCatalog = lazy(() => import('./components/helm/HelmChartCatalog'));
const HelmChartWorkspace = lazy(() => import('./components/helm/HelmChartWorkspace'));
const ArgoCDDeploy = lazy(() => import('./components/deploy/ArgoCDDeploy'));
const ClusterManagement = lazy(() => import('./components/clusters/ClusterManagement'));
const SecurityDashboard = lazy(() => import('./components/security/SecurityDashboard'));
// const ClusterCostDashboard = lazy(() => import('./components/cost/ClusterCostDashboard'));  // Excluded from v1.4.0
const EventLogs = lazy(() => import('./components/events/EventLogs'));
const NetworkingDashboard = lazy(() => import('./components/networking/NetworkingDashboard'));
const UserManagement = lazy(() => import('./components/admin/UserManagement'));
const AuditLogs = lazy(() => import('./components/admin/AuditLogs'));
const ApiKeysPage = lazy(() => import('./components/admin/ApiKeysPage'));
const ProfileSettings = lazy(() => import('./components/auth/ProfileSettings'));
const IntegrationPage = lazy(() => import('./components/integrations/IntegrationPage'));
const AboutPage = lazy(() => import('./components/about/AboutPage'));
const ClusterOverview = lazy(() => import('./components/cluster/ClusterOverview'));
const NamespacesPage = lazy(() => import('./components/namespaces/NamespacesPage'));
const AIOptimizationHub = lazy(() => import('./components/optimization/AIOptimizationHub'));
const StoragePage = lazy(() => import('./components/storage/StoragePage'));
const ConfigurationPage = lazy(() => import('./components/kubernetes/ConfigurationPage'));
const SettingsIntegrationsPage = lazy(() => import('./components/settings/IntegrationsPage'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));
const MonitoringDashboard = lazy(() => import('./components/monitoring/MonitoringDashboard'));
const PrometheusSetup = lazy(() => import('./components/prometheus/PrometheusSetup'));
const MetricsExplorer = lazy(() => import('./components/prometheus/MetricsExplorer'));
const AlertsView = lazy(() => import('./components/prometheus/AlertsView'));
const TargetsView = lazy(() => import('./components/prometheus/TargetsView'));
const AIChatPanel = lazy(() => import('./components/common/AIChatPanel').then(m => ({ default: m.default })));

// Pipeline Module - Excluded from v1.4.0 release
// const PipelinesPage = lazy(() => import('./components/pipelines/PipelinesPage'));
// const PipelineEditor = lazy(() => import('./components/pipelines/PipelineEditor'));
// const PipelineDetails = lazy(() => import('./components/pipelines/PipelineDetails'));
// const PipelineRunDetail = lazy(() => import('./components/pipelines/PipelineRunDetail'));
// const PipelineRunHistory = lazy(() => import('./components/pipelines/PipelineRunHistory'));
// const PipelineLogs = lazy(() => import('./components/pipelines/PipelineLogs'));

import { AIChatTrigger } from './components/common/AIChatPanel';
import CommandPalette, { useCommandPalette } from './components/common/CommandPalette';

// Create QueryClient with default options for caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 30 seconds by default
      staleTime: 30 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Don't refetch on window focus by default (reduces API calls)
      refetchOnWindowFocus: false,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
  },
});

// Smooth scroll restoration
function ScrollToTop() {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Don't scroll on first render (page load/reload)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Only scroll on navigation between routes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
}

// Loading fallback
function PageLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-center justify-center h-64"
    >
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading...</span>
      </div>
    </motion.div>
  );
}

// Page transition
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigate = (e: CustomEvent<{ path: string }>) => {
      navigate(e.detail.path);
    };

    const handleOpenAiChat = () => {
      setIsChatOpen(true);
    };

    window.addEventListener('navigate', handleNavigate as EventListener);
    window.addEventListener('open-ai-chat', handleOpenAiChat);

    return () => {
      window.removeEventListener('navigate', handleNavigate as EventListener);
      window.removeEventListener('open-ai-chat', handleOpenAiChat);
    };
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <ScrollToTop />
              <DualSidebarLayout>
                <Suspense fallback={<PageLoader />}>
                  <PageTransition>
                    <Routes>
                      {/* Dashboard */}
                      <Route path="/" element={<Dashboard />} />

                      {/* KUBERNETES MODULE */}
                      <Route path="/cluster-overview" element={<ClusterOverview />} />
                      <Route path="/kubernetes/nodes" element={<NodesView />} />
                      <Route path="/namespaces" element={<NamespacesPage />} />
                      <Route path="/kubernetes/workloads" element={<KubernetesResourcesView />} />
                      <Route path="/kubernetes/networking" element={<NetworkingDashboard />} />
                      <Route path="/kubernetes/storage" element={<StoragePage />} />
                      <Route path="/kubernetes/configuration" element={<ConfigurationPage />} />
                      <Route path="/kubernetes" element={<Navigate to="/kubernetes/workloads" replace />} />
                      <Route path="/networking" element={<Navigate to="/kubernetes/networking" replace />} />
                      <Route path="/storage" element={<Navigate to="/kubernetes/storage" replace />} />
                      <Route path="/kubernetes/metrics" element={<ClusterMetrics />} />
                      <Route path="/kubernetes/terminal" element={<KubectlTerminal />} />

                      {/* DEPLOY MODULE */}
                      <Route path="/deploy/yaml" element={<YAMLDeployEnhanced />} />
                      <Route path="/deploy/helm" element={<HelmDashboard />} />
                      <Route path="/deploy/helm/catalog" element={<HelmChartCatalog />} />
                      <Route path="/deploy/helm/workspace" element={<HelmChartWorkspace />} />
                      <Route path="/deploy/helm/workspace/:namespace/:releaseName" element={<HelmChartWorkspace />} />
                      <Route path="/deploy/helm/install" element={<HelmDeploy />} />
                      <Route path="/deploy/argocd" element={<ArgoCDDeploy />} />
                      <Route path="/deploy" element={<Navigate to="/deploy/yaml" replace />} />
                      <Route path="/gitops" element={<Navigate to="/deploy/argocd" replace />} />

                      {/* ============================================ */}
                      {/* PIPELINES MODULE - Excluded from v1.4.0 */}
                      {/* ============================================ */}
                      {/* Coming in future release
                      <Route path="/pipelines" element={<PipelinesPage />} />
                      <Route path="/pipelines/new" element={<PipelineEditor />} />
                      <Route path="/pipelines/:id/edit" element={<PipelineEditor />} />
                      <Route path="/pipelines/:id" element={<PipelineDetails />} />
                      <Route path="/pipelines/:id/history" element={<PipelineRunHistory />} />
                      <Route path="/pipelines/:id/runs/:runId" element={<PipelineRunDetail />} />
                      <Route path="/pipelines/:id/runs/:runId/logs" element={<PipelineLogs />} />
                      */}

                      {/* AI OPTIMIZER */}
                      <Route path="/optimization" element={<AIOptimizationHub />} />

                      {/* SECURITY */}
                      <Route path="/security" element={<SecurityDashboard />} />

                      {/* MONITORING */}
                      <Route path="/monitoring" element={<MonitoringDashboard />} />
                      <Route path="/monitoring/prometheus" element={<PrometheusSetup />} />
                      <Route path="/monitoring/prometheus/explorer" element={<MetricsExplorer />} />
                      <Route path="/monitoring/prometheus/alerts" element={<AlertsView />} />
                      <Route path="/monitoring/prometheus/targets" element={<TargetsView />} />

                      {/* COST ANALYZER - Excluded from v1.4.0 */}
                      {/* <Route path="/cost" element={<ClusterCostDashboard />} /> */}

                      {/* INTEGRATIONS */}
                      <Route path="/integrations" element={<SettingsIntegrationsPage />} />

                      {/* SETTINGS */}
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/profile" element={<ProfileSettings />} />

                      {/* ADMIN & OTHER */}
                      <Route path="/clusters" element={<ClusterManagement />} />
                      <Route path="/events" element={<EventLogs />} />
                      <Route path="/admin/users" element={<UserManagement />} />
                      <Route path="/admin/audit-logs" element={<AuditLogs />} />
                      <Route path="/admin/api-keys" element={<ApiKeysPage />} />
                      <Route path="/admin/roles" element={<Navigate to="/admin/users" replace />} />
                      <Route path="/about" element={<AboutPage />} />

                      {/* Legacy routes */}
                      <Route path="/settings/integrations" element={<Navigate to="/integrations" replace />} />
                      <Route path="/integrations/:type" element={<IntegrationPage />} />
                    </Routes>
                  </PageTransition>
                </Suspense>
              </DualSidebarLayout>

              {/* AI Chat Panel */}
              <AnimatePresence>
                {isChatOpen && (
                  <Suspense fallback={null}>
                    <AIChatPanel onClose={() => setIsChatOpen(false)} />
                  </Suspense>
                )}
              </AnimatePresence>

              {/* AI Chat Trigger */}
              {!isChatOpen && <AIChatTrigger onClick={() => setIsChatOpen(true)} />}

              {/* Command Palette */}
              <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={closeCommandPalette}
                onOpenAIChat={() => setIsChatOpen(true)}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ClusterProvider>
            <NamespaceProvider>
              <TerminalProvider>
                <ToastProvider>
                  <NotificationProvider>
                    <AppContent />
                  </NotificationProvider>
                </ToastProvider>
              </TerminalProvider>
            </NamespaceProvider>
          </ClusterProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;