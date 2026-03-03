'use client';

/**
 * Plan Badge
 * 
 * A small badge indicating the user's current plan tier.
 * Can be used in headers, profiles, or API key displays.
 */

import React from 'react';
import {
  SparklesIcon,
  BoltIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';

interface PlanBadgeProps {
  tier: 'free' | 'pro' | 'enterprise';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const TIER_CONFIG = {
  free: {
    label: 'Free',
    icon: SparklesIcon,
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-600',
    iconColor: 'text-gray-500',
  },
  pro: {
    label: 'Pro',
    icon: BoltIcon,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-600',
    iconColor: 'text-blue-500',
  },
  enterprise: {
    label: 'Enterprise',
    icon: BuildingOffice2Icon,
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-300 dark:border-purple-600',
    iconColor: 'text-purple-500',
  },
};

const SIZE_CONFIG = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    icon: 'w-3 h-3',
    gap: 'gap-1',
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-sm',
    icon: 'w-4 h-4',
    gap: 'gap-1.5',
  },
  lg: {
    padding: 'px-3 py-1.5',
    text: 'text-base',
    icon: 'w-5 h-5',
    gap: 'gap-2',
  },
};

export default function PlanBadge({
  tier,
  size = 'md',
  showIcon = true,
  className = '',
}: PlanBadgeProps) {
  const tierConfig = TIER_CONFIG[tier];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = tierConfig.icon;

  return (
    <span
      className={`
        inline-flex items-center ${sizeConfig.gap} ${sizeConfig.padding}
        ${tierConfig.bgColor} ${tierConfig.textColor}
        border ${tierConfig.borderColor}
        rounded-full font-medium ${sizeConfig.text}
        ${className}
      `}
    >
      {showIcon && (
        <Icon className={`${sizeConfig.icon} ${tierConfig.iconColor}`} />
      )}
      {tierConfig.label}
    </span>
  );
}

/**
 * Plan Badge with upgrade prompt
 */
interface PlanBadgeWithUpgradeProps extends PlanBadgeProps {
  onUpgrade?: () => void;
}

export function PlanBadgeWithUpgrade({
  tier,
  size = 'md',
  showIcon = true,
  onUpgrade,
  className = '',
}: PlanBadgeWithUpgradeProps) {
  if (tier === 'enterprise') {
    return <PlanBadge tier={tier} size={size} showIcon={showIcon} className={className} />;
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <PlanBadge tier={tier} size={size} showIcon={showIcon} />
      <button
        onClick={onUpgrade}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        Upgrade
      </button>
    </div>
  );
}

/**
 * Feature gate badge - shows if a feature is available on current plan
 */
interface FeatureGateProps {
  requiredTier: 'free' | 'pro' | 'enterprise';
  currentTier: 'free' | 'pro' | 'enterprise';
  children: React.ReactNode;
  className?: string;
}

const TIER_LEVELS = { free: 0, pro: 1, enterprise: 2 };

export function FeatureGate({
  requiredTier,
  currentTier,
  children,
  className = '',
}: FeatureGateProps) {
  const hasAccess = TIER_LEVELS[currentTier] >= TIER_LEVELS[requiredTier];

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg backdrop-blur-sm">
        <div className="text-center p-4">
          <PlanBadge tier={requiredTier} size="sm" className="mb-2" />
          <p className="text-sm text-white font-medium">
            Upgrade to {requiredTier === 'pro' ? 'Pro' : 'Enterprise'} to unlock
          </p>
        </div>
      </div>
    </div>
  );
}
