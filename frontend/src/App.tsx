import { useState, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './contexts/ThemeContext';
import { TerminalProvider } from './contexts/TerminalContext';
import { ClusterProvider } from './contexts/ClusterContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/common/Layout';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Lazy load heavy components for code splitting
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const IncidentList = lazy(() => import('./components/incidents/IncidentList'));
const IncidentDetail = lazy(() => import('./components/incidents/IncidentDetail'));
const Timeline = lazy(() => import('./components/timeline/Timeline'));
const SelfServicePortal = lazy(() => import('./components/selfservice/SelfServicePortal'));
const ReleaseManager = lazy(() => import('./components/selfservice/ReleaseManager'));
const NodesView = lazy(() => import('./components/kubernetes/NodesView'));
const ClusterMetrics = lazy(() => import('./components/kubernetes/ClusterMetrics'));
const KubernetesResourcesView = lazy(() => import('./components/kubernetes/KubernetesResourcesView'));
const YAMLDeploy = lazy(() => import('./components/kubernetes/YAMLDeploy'));
const KubectlTerminal = lazy(() => import('./components/kubernetes/KubectlTerminal'));
const HelmDashboard = lazy(() => import('./components/helm/HelmDashboard'));
const CostDashboard = lazy(() => import('./components/cost/CostDashboard'));
const ClusterManagement = lazy(() => import('./components/clusters/ClusterManagement'));
const SecurityDashboard = lazy(() => import('./components/security/SecurityDashboard'));
const AIChatPanel = lazy(() => import('./components/common/AIChatPanel').then(m => ({ default: m.default })));

import { AIChatTrigger } from './components/common/AIChatPanel';
import CommandPalette, { useCommandPalette } from './components/common/CommandPalette';

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading...</span>
      </div>
    </div>
  );
}

function AppContent() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/kubernetes" element={<KubernetesResourcesView />} />
                    <Route path="/kubernetes/nodes" element={<NodesView />} />
                    <Route path="/kubernetes/metrics" element={<ClusterMetrics />} />
                    <Route path="/kubernetes/deploy" element={<YAMLDeploy />} />
                    <Route path="/kubernetes/terminal" element={<KubectlTerminal />} />
                    <Route path="/clusters" element={<ClusterManagement />} />
                    <Route path="/incidents" element={<IncidentList />} />
                    <Route path="/incidents/:id" element={<IncidentDetail />} />
                    <Route path="/timeline" element={<Timeline />} />
                    <Route path="/selfservice" element={<SelfServicePortal />} />
                    <Route path="/releases" element={<ReleaseManager />} />
                    <Route path="/helm" element={<HelmDashboard />} />
                    <Route path="/cost" element={<CostDashboard />} />
                    <Route path="/security" element={<SecurityDashboard />} />
                  </Routes>
                </Suspense>
              </Layout>

              {/* AI Chat Panel */}
              <AnimatePresence>
                {isChatOpen && (
                  <Suspense fallback={null}>
                    <AIChatPanel onClose={() => setIsChatOpen(false)} />
                  </Suspense>
                )}
              </AnimatePresence>

              {/* AI Chat Trigger Button */}
              {!isChatOpen && (
                <AIChatTrigger onClick={() => setIsChatOpen(true)} />
              )}

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
    <ThemeProvider>
      <AuthProvider>
        <ClusterProvider>
          <TerminalProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </TerminalProvider>
        </ClusterProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
