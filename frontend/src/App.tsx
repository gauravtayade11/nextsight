import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { TerminalProvider } from './contexts/TerminalContext';
import { ClusterProvider } from './contexts/ClusterContext';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/common/Layout';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Dashboard from './components/dashboard/Dashboard';
import KubernetesView from './components/dashboard/KubernetesView';
import IncidentList from './components/incidents/IncidentList';
import IncidentDetail from './components/incidents/IncidentDetail';
import Timeline from './components/timeline/Timeline';
import SelfServicePortal from './components/selfservice/SelfServicePortal';
import ReleaseManager from './components/selfservice/ReleaseManager';
import NodesView from './components/kubernetes/NodesView';
import ClusterMetrics from './components/kubernetes/ClusterMetrics';
import KubernetesResourcesView from './components/kubernetes/KubernetesResourcesView';
import YAMLDeploy from './components/kubernetes/YAMLDeploy';
import KubectlTerminal from './components/kubernetes/KubectlTerminal';
import HelmDashboard from './components/helm/HelmDashboard';
import CostDashboard from './components/cost/CostDashboard';
import ClusterManagement from './components/clusters/ClusterManagement';
import SecurityDashboard from './components/security/SecurityDashboard';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClusterProvider>
          <TerminalProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/kubernetes" element={<KubernetesView />} />
                        <Route path="/kubernetes/nodes" element={<NodesView />} />
                        <Route path="/kubernetes/metrics" element={<ClusterMetrics />} />
                        <Route path="/kubernetes/resources" element={<KubernetesResourcesView />} />
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
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </TerminalProvider>
        </ClusterProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
