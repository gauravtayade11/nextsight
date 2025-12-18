/**
 * Utils Index
 * Re-exports all utility functions and constants
 */

// Constants and configurations
export {
  // Animation variants
  containerVariants,
  itemVariants,
  fadeInVariants,
  slideUpVariants,
  scaleVariants,
  slideRightVariants,
  TRANSITION_DURATION,
  // Status configurations
  STATUS_CONFIG,
  SEVERITY_CONFIG,
  getStatusConfig,
  getStatusClasses,
  getSeverityConfig,
  // Color palette
  COLOR_PALETTE,
  // Utility functions
  formatAge,
  formatBytes,
  formatNumber,
  formatCurrency,
  formatPercentage,
  truncateText,
  // Types
  type StatusType,
  type SeverityType,
  type StatusConfig,
  type ColorVariant,
  type ColorConfig,
} from './constants';

// Axios instance
export { default as api } from './axios';
