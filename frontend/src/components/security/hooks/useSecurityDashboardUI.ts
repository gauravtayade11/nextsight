/**
 * Custom hook to manage SecurityDashboard UI state
 * Consolidates 25+ useState calls into organized state management
 */
import { useState, useCallback } from 'react';
import { securityApi } from '../../../services/api';
import type {
  SecurityFinding,
  ImageScanResult,
  RBACAnalysisDetail,
  NetworkPolicyDetail,
  SecurityTrendsDetail,
  AIRemediationResponse,
} from '../types';

// ============================================
// STATE INTERFACES
// ============================================

interface ScanningState {
  scanning: boolean;
  loadingImages: boolean;
}

interface ImageScanState {
  imageScans: ImageScanResult[];
  showImageScans: boolean;
  expandedImage: string | null;
}

interface ModalState {
  showRbacModal: boolean;
  showNetPolModal: boolean;
  showTrendsModal: boolean;
  showAiModal: boolean;
  showHelp: boolean;
  showInlineAi: boolean;
}

interface DetailState {
  rbacDetail: RBACAnalysisDetail | null;
  networkPolicyDetail: NetworkPolicyDetail | null;
  trendsDetail: SecurityTrendsDetail | null;
  loadingRbacDetail: boolean;
  loadingNetPolDetail: boolean;
  loadingTrendsDetail: boolean;
}

interface AIState {
  aiRemediation: AIRemediationResponse | null;
  loadingAiRemediation: string | null;
  aiError: string | null;
}

interface UIState {
  error: string | null;
  selectedFinding: SecurityFinding | null;
  copiedCode: string | null;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useSecurityDashboardUI() {
  // Scanning state
  const [scanningState, setScanningState] = useState<ScanningState>({
    scanning: false,
    loadingImages: false,
  });

  // Image scan state
  const [imageScanState, setImageScanState] = useState<ImageScanState>({
    imageScans: [],
    showImageScans: false,
    expandedImage: null,
  });

  // Modal visibility state
  const [modalState, setModalState] = useState<ModalState>({
    showRbacModal: false,
    showNetPolModal: false,
    showTrendsModal: false,
    showAiModal: false,
    showHelp: false,
    showInlineAi: false,
  });

  // Detail data state
  const [detailState, setDetailState] = useState<DetailState>({
    rbacDetail: null,
    networkPolicyDetail: null,
    trendsDetail: null,
    loadingRbacDetail: false,
    loadingNetPolDetail: false,
    loadingTrendsDetail: false,
  });

  // AI remediation state
  const [aiState, setAIState] = useState<AIState>({
    aiRemediation: null,
    loadingAiRemediation: null,
    aiError: null,
  });

  // General UI state
  const [uiState, setUIState] = useState<UIState>({
    error: null,
    selectedFinding: null,
    copiedCode: null,
  });

  // ============================================
  // ACTIONS
  // ============================================

  // Scanning actions
  const setScanning = useCallback((scanning: boolean) => {
    setScanningState(prev => ({ ...prev, scanning }));
  }, []);

  const setLoadingImages = useCallback((loadingImages: boolean) => {
    setScanningState(prev => ({ ...prev, loadingImages }));
  }, []);

  // Image scan actions
  const setImageScans = useCallback((imageScans: ImageScanResult[]) => {
    setImageScanState(prev => ({ ...prev, imageScans }));
  }, []);

  const toggleImageScans = useCallback(() => {
    setImageScanState(prev => ({ ...prev, showImageScans: !prev.showImageScans }));
  }, []);

  const setExpandedImage = useCallback((expandedImage: string | null) => {
    setImageScanState(prev => ({ ...prev, expandedImage }));
  }, []);

  // Modal actions
  const openModal = useCallback((modal: keyof ModalState) => {
    setModalState(prev => ({ ...prev, [modal]: true }));
  }, []);

  const closeModal = useCallback((modal: keyof ModalState) => {
    setModalState(prev => ({ ...prev, [modal]: false }));
  }, []);

  const toggleModal = useCallback((modal: keyof ModalState) => {
    setModalState(prev => ({ ...prev, [modal]: !prev[modal] }));
  }, []);

  // Detail loading actions
  const loadRbacDetail = useCallback(async () => {
    setDetailState(prev => ({ ...prev, loadingRbacDetail: true }));
    try {
      const response = await securityApi.getRBACDetailed();
      setDetailState(prev => ({
        ...prev,
        rbacDetail: response.data,
        loadingRbacDetail: false,
      }));
      setModalState(prev => ({ ...prev, showRbacModal: true }));
    } catch {
      setDetailState(prev => ({ ...prev, loadingRbacDetail: false }));
    }
  }, []);

  const loadNetworkPolicyDetail = useCallback(async () => {
    setDetailState(prev => ({ ...prev, loadingNetPolDetail: true }));
    try {
      const response = await securityApi.getNetworkPoliciesDetailed();
      setDetailState(prev => ({
        ...prev,
        networkPolicyDetail: response.data,
        loadingNetPolDetail: false,
      }));
      setModalState(prev => ({ ...prev, showNetPolModal: true }));
    } catch {
      setDetailState(prev => ({ ...prev, loadingNetPolDetail: false }));
    }
  }, []);

  const loadTrendsDetail = useCallback(async () => {
    setDetailState(prev => ({ ...prev, loadingTrendsDetail: true }));
    try {
      const response = await securityApi.getTrendsDetailed();
      setDetailState(prev => ({
        ...prev,
        trendsDetail: response.data,
        loadingTrendsDetail: false,
      }));
      setModalState(prev => ({ ...prev, showTrendsModal: true }));
    } catch {
      setDetailState(prev => ({ ...prev, loadingTrendsDetail: false }));
    }
  }, []);

  // AI remediation actions
  const loadAIRemediation = useCallback(async (finding: SecurityFinding) => {
    setAIState(prev => ({ ...prev, loadingAiRemediation: finding.id, aiError: null }));
    try {
      const response = await securityApi.getAIRemediation({
        finding_type: finding.type,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        resource_type: finding.resource_type,
        resource_name: finding.resource_name,
        namespace: finding.namespace,
        cve_id: finding.cve_id,
      });
      setAIState(prev => ({
        ...prev,
        aiRemediation: response.data,
        loadingAiRemediation: null,
      }));
      setModalState(prev => ({ ...prev, showAiModal: true }));
    } catch (err: any) {
      setAIState(prev => ({
        ...prev,
        loadingAiRemediation: null,
        aiError: err.message || 'Failed to get AI remediation',
      }));
    }
  }, []);

  const clearAIRemediation = useCallback(() => {
    setAIState({ aiRemediation: null, loadingAiRemediation: null, aiError: null });
    setModalState(prev => ({ ...prev, showAiModal: false }));
  }, []);

  // UI actions
  const setError = useCallback((error: string | null) => {
    setUIState(prev => ({ ...prev, error }));
  }, []);

  const setSelectedFinding = useCallback((finding: SecurityFinding | null) => {
    setUIState(prev => ({ ...prev, selectedFinding: finding }));
  }, []);

  const copyToClipboard = useCallback(async (code: string) => {
    await navigator.clipboard.writeText(code);
    setUIState(prev => ({ ...prev, copiedCode: code }));
    setTimeout(() => setUIState(prev => ({ ...prev, copiedCode: null })), 2000);
  }, []);

  // ============================================
  // RETURN VALUE
  // ============================================

  return {
    // State
    scanning: scanningState.scanning,
    loadingImages: scanningState.loadingImages,
    imageScans: imageScanState.imageScans,
    showImageScans: imageScanState.showImageScans,
    expandedImage: imageScanState.expandedImage,
    ...modalState,
    ...detailState,
    ...aiState,
    error: uiState.error,
    selectedFinding: uiState.selectedFinding,
    copiedCode: uiState.copiedCode,

    // Actions
    setScanning,
    setLoadingImages,
    setImageScans,
    toggleImageScans,
    setExpandedImage,
    openModal,
    closeModal,
    toggleModal,
    loadRbacDetail,
    loadNetworkPolicyDetail,
    loadTrendsDetail,
    loadAIRemediation,
    clearAIRemediation,
    setError,
    setSelectedFinding,
    copyToClipboard,
  };
}

export default useSecurityDashboardUI;
