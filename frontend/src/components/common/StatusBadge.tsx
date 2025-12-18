/**
 * StatusBadge Component
 * A unified status badge component that provides consistent styling across
 * all status displays in the application.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  QuestionMarkCircleIcon,
  MinusCircleIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  SignalIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleSolidIcon,
  XCircleIcon as XCircleSolidIcon,
  ExclamationTriangleIcon as ExclamationTriangleSolidIcon,
} from '@heroicons/react/24/solid';
import { getStatusConfig, getSeverityConfig, type StatusType, type SeverityType } from '../../utils/constants';

// =============================================================================
// TYPES
// =============================================================================

export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';
export type BadgeStyle = 'filled' | 'outline' | 'dot';

export interface StatusBadgeProps {
  /** The status to display */
  status: string;
  /** Custom label (overrides default status label) */
  label?: string;
  /** Badge size */
  size?: BadgeSize;
  /** Badge style variant */
  variant?: BadgeStyle;
  /** Show icon */
  showIcon?: boolean;
  /** Animate pulsing for pending/progressing states */
  animate?: boolean;
  /** Use solid icons instead of outline */
  solid?: boolean;
  /** Additional className */
  className?: string;
}

export interface SeverityBadgeProps {
  /** The severity level to display */
  severity: string;
  /** Custom label */
  label?: string;
  /** Badge size */
  size?: BadgeSize;
  /** Badge style variant */
  variant?: BadgeStyle;
  /** Show icon */
  showIcon?: boolean;
  /** Additional className */
  className?: string;
}

// =============================================================================
// ICON MAPPING
// =============================================================================

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  // Success states
  success: CheckCircleIcon,
  running: PlayIcon,
  healthy: CheckCircleIcon,
  deployed: CheckCircleIcon,
  active: CheckCircleIcon,
  connected: SignalIcon,
  synced: CheckCircleIcon,

  // Warning states
  warning: ExclamationTriangleIcon,
  pending: ClockIcon,
  progressing: ArrowPathIcon,
  degraded: ExclamationTriangleIcon,
  installing: ClockIcon,
  upgrading: ArrowPathIcon,

  // Error states
  error: XCircleIcon,
  failed: XCircleIcon,
  critical: XCircleIcon,
  disconnected: SignalSlashIcon,
  terminated: StopIcon,

  // Neutral states
  info: QuestionMarkCircleIcon,
  unknown: QuestionMarkCircleIcon,
  default: MinusCircleIcon,
  paused: PauseIcon,
  stopped: StopIcon,
};

const solidIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  success: CheckCircleSolidIcon,
  running: CheckCircleSolidIcon,
  healthy: CheckCircleSolidIcon,
  deployed: CheckCircleSolidIcon,
  error: XCircleSolidIcon,
  failed: XCircleSolidIcon,
  critical: XCircleSolidIcon,
  warning: ExclamationTriangleSolidIcon,
};

// =============================================================================
// SIZE CONFIGURATIONS
// =============================================================================

const sizeConfig: Record<BadgeSize, { badge: string; icon: string; dot: string }> = {
  xs: {
    badge: 'px-1.5 py-0.5 text-[10px] gap-1',
    icon: 'h-3 w-3',
    dot: 'h-1.5 w-1.5',
  },
  sm: {
    badge: 'px-2 py-0.5 text-xs gap-1',
    icon: 'h-3.5 w-3.5',
    dot: 'h-2 w-2',
  },
  md: {
    badge: 'px-2.5 py-1 text-xs gap-1.5',
    icon: 'h-4 w-4',
    dot: 'h-2 w-2',
  },
  lg: {
    badge: 'px-3 py-1.5 text-sm gap-2',
    icon: 'h-5 w-5',
    dot: 'h-2.5 w-2.5',
  },
};

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

/**
 * StatusBadge - Displays status with consistent styling
 *
 * @example
 * // Basic usage
 * <StatusBadge status="running" />
 *
 * // With custom label
 * <StatusBadge status="deployed" label="Live" />
 *
 * // Different sizes
 * <StatusBadge status="pending" size="lg" />
 *
 * // Outline variant
 * <StatusBadge status="failed" variant="outline" />
 *
 * // Dot variant (minimal)
 * <StatusBadge status="healthy" variant="dot" />
 */
export function StatusBadge({
  status,
  label,
  size = 'sm',
  variant = 'filled',
  showIcon = true,
  animate = true,
  solid = false,
  className = '',
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/[_-]/g, '');
  const config = getStatusConfig(status);
  const sizes = sizeConfig[size];

  // Determine if this is an animated state
  const isAnimatedState =
    animate &&
    ['pending', 'progressing', 'installing', 'upgrading'].includes(normalizedStatus);

  // Get the appropriate icon
  const IconComponent =
    (solid && solidIcons[normalizedStatus]) ||
    statusIcons[normalizedStatus] ||
    statusIcons.default;

  // Build class strings based on variant
  let variantClasses = '';
  switch (variant) {
    case 'filled':
      variantClasses = `${config.bgColor} ${config.darkBgColor} ${config.textColor} ${config.darkTextColor}`;
      break;
    case 'outline':
      variantClasses = `bg-transparent border ${config.borderColor} ${config.textColor} ${config.darkTextColor}`;
      break;
    case 'dot':
      variantClasses = 'bg-transparent text-gray-700 dark:text-gray-300';
      break;
  }

  const displayLabel = label || config.label;

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${sizes.badge}
        ${variantClasses}
        ${className}
      `}
    >
      {variant === 'dot' ? (
        <span
          className={`
            ${sizes.dot} rounded-full
            ${config.bgColor.replace('-100', '-500')}
            ${isAnimatedState ? 'animate-pulse' : ''}
          `}
        />
      ) : showIcon ? (
        <IconComponent
          className={`
            ${sizes.icon}
            ${isAnimatedState ? 'animate-spin' : ''}
          `}
        />
      ) : null}
      {displayLabel}
    </span>
  );
}

// =============================================================================
// SEVERITY BADGE COMPONENT
// =============================================================================

/**
 * SeverityBadge - Displays severity levels with consistent styling
 *
 * @example
 * <SeverityBadge severity="critical" />
 * <SeverityBadge severity="high" />
 * <SeverityBadge severity="medium" />
 * <SeverityBadge severity="low" />
 */
export function SeverityBadge({
  severity,
  label,
  size = 'sm',
  variant = 'filled',
  showIcon = true,
  className = '',
}: SeverityBadgeProps) {
  const config = getSeverityConfig(severity);
  const sizes = sizeConfig[size];

  // Severity icons
  const severityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    critical: XCircleIcon,
    high: ExclamationTriangleIcon,
    medium: ExclamationTriangleIcon,
    low: QuestionMarkCircleIcon,
    info: QuestionMarkCircleIcon,
  };

  const IconComponent = severityIcons[severity.toLowerCase()] || QuestionMarkCircleIcon;

  // Build class strings based on variant
  let variantClasses = '';
  switch (variant) {
    case 'filled':
      variantClasses = `${config.bgColor} ${config.darkBgColor} ${config.textColor} ${config.darkTextColor}`;
      break;
    case 'outline':
      variantClasses = `bg-transparent border ${config.borderColor} ${config.textColor} ${config.darkTextColor}`;
      break;
    case 'dot':
      variantClasses = 'bg-transparent text-gray-700 dark:text-gray-300';
      break;
  }

  const displayLabel = label || severity.toUpperCase();

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${sizes.badge}
        ${variantClasses}
        ${className}
      `}
    >
      {variant === 'dot' ? (
        <span
          className={`
            ${sizes.dot} rounded-full
            ${config.bgColor.replace('-100', '-500')}
          `}
        />
      ) : showIcon ? (
        <IconComponent className={sizes.icon} />
      ) : null}
      {displayLabel}
    </span>
  );
}

// =============================================================================
// HEALTH INDICATOR COMPONENT
// =============================================================================

export interface HealthIndicatorProps {
  healthy: boolean;
  size?: BadgeSize;
  showLabel?: boolean;
  className?: string;
}

/**
 * HealthIndicator - Simple healthy/unhealthy indicator
 *
 * @example
 * <HealthIndicator healthy={true} />
 * <HealthIndicator healthy={false} showLabel />
 */
export function HealthIndicator({
  healthy,
  size = 'sm',
  showLabel = false,
  className = '',
}: HealthIndicatorProps) {
  const sizes = sizeConfig[size];
  const status = healthy ? 'healthy' : 'unhealthy';
  const config = getStatusConfig(status);

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        ${showLabel ? config.textColor + ' ' + config.darkTextColor : ''}
        ${className}
      `}
    >
      <span
        className={`
          ${sizes.dot} rounded-full
          ${healthy ? 'bg-emerald-500' : 'bg-red-500'}
        `}
      />
      {showLabel && (
        <span className={`text-${size === 'xs' ? '[10px]' : 'xs'} font-medium`}>
          {healthy ? 'Healthy' : 'Unhealthy'}
        </span>
      )}
    </span>
  );
}

// =============================================================================
// CONNECTION STATUS COMPONENT
// =============================================================================

export interface ConnectionStatusProps {
  connected: boolean;
  size?: BadgeSize;
  showLabel?: boolean;
  className?: string;
}

/**
 * ConnectionStatus - Shows connection status indicator
 *
 * @example
 * <ConnectionStatus connected={true} showLabel />
 */
export function ConnectionStatus({
  connected,
  size = 'sm',
  showLabel = true,
  className = '',
}: ConnectionStatusProps) {
  return (
    <StatusBadge
      status={connected ? 'connected' : 'disconnected'}
      size={size}
      showIcon={showLabel}
      variant={showLabel ? 'filled' : 'dot'}
      className={className}
    />
  );
}

// =============================================================================
// SYNC STATUS COMPONENT (for ArgoCD, GitOps)
// =============================================================================

export interface SyncStatusProps {
  status: 'Synced' | 'OutOfSync' | 'Unknown' | string;
  size?: BadgeSize;
  className?: string;
}

/**
 * SyncStatus - Shows sync status for GitOps resources
 *
 * @example
 * <SyncStatus status="Synced" />
 * <SyncStatus status="OutOfSync" />
 */
export function SyncStatus({ status, size = 'sm', className = '' }: SyncStatusProps) {
  const statusMap: Record<string, StatusType> = {
    synced: 'synced',
    outofsync: 'warning',
    unknown: 'unknown',
  };

  const normalizedStatus = status.toLowerCase().replace(/[_-]/g, '');
  const mappedStatus = statusMap[normalizedStatus] || 'unknown';

  const labels: Record<string, string> = {
    synced: 'Synced',
    outofsync: 'Out of Sync',
    unknown: 'Unknown',
  };

  return (
    <StatusBadge
      status={mappedStatus}
      label={labels[normalizedStatus] || status}
      size={size}
      className={className}
    />
  );
}

// =============================================================================
// EXPORT ALL
// =============================================================================

export default StatusBadge;
