/**
 * @fileoverview Premium UI Components Index
 * 
 * Exports all UI components for easy importing.
 * 
 * @module components/ui
 * 
 * @example
 * import { Button, Card, Badge, Input } from '@/components/ui';
 */

// Button Components
export { default as Button, IconButton } from './Button';
export type { ButtonProps, IconButtonProps } from './Button';

// Card Components
export { default as Card, CardHeader, CardContent, CardFooter, StatCard, FeatureCard } from './Card';
export type { CardProps, CardHeaderProps, StatCardProps, FeatureCardProps } from './Card';

// Badge Components
export { default as Badge, PriceChangeBadge, RankBadge, StatusBadge, ChainBadge } from './Badge';
export type { BadgeProps, PriceChangeBadgeProps, RankBadgeProps, StatusBadgeProps, ChainBadgeProps } from './Badge';

// Input Components
export { default as Input, SearchInput, NumberInput, Textarea } from './Input';
export type { InputProps, SearchInputProps, NumberInputProps, TextareaProps } from './Input';

// Tooltip Component
export { default as Tooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';

// Modal Component
export { Modal, ConfirmModal } from './Modal';
export type { ModalProps, ConfirmModalProps } from './Modal';

// Progress Components
export { default as Progress, ProgressBar, CircularProgress } from './Progress';
export type { ProgressProps, ProgressBarProps, CircularProgressProps } from './Progress';

// Divider Component
export { default as Divider } from './Divider';
export type { DividerProps } from './Divider';

// Avatar Component
export { default as Avatar, AvatarGroup } from './Avatar';
export type { AvatarProps, AvatarGroupProps } from './Avatar';

// Skeleton Component
export { default as Skeleton, TextSkeleton, AvatarSkeleton, CardSkeleton, TableRowSkeleton, CoinRowSkeleton, ChartSkeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

// Enhanced Skeleton Component
export {
  EnhancedSkeleton,
  SkeletonStagger,
  EnhancedTextSkeleton,
  EnhancedAvatarSkeleton,
  EnhancedCardSkeleton,
  EnhancedTableRowSkeleton,
  EnhancedChartSkeleton,
} from './EnhancedSkeleton';
export type { EnhancedSkeletonProps, SkeletonStaggerProps } from './EnhancedSkeleton';

// Sparkline Component
export { default as Sparkline, SparklineWithLoader, InlineSparkline } from './Sparkline';
export type { SparklineProps } from './Sparkline';

// Micro-Animation Components
export {
  AnimatedNumber,
  AnimatedCounter,
  Typewriter,
  FadeIn,
  FadeStagger,
  RippleButton,
  Ripple,
  Float,
  Shake,
  PulseGlow,
  PriceFlash,
  PriceFlashWrapper,
  ValueUpdate,
  StaggerContainer,
  SkeletonWave,
  Confetti,
} from './MicroAnimations';
export type {
  AnimatedNumberProps,
  AnimatedCounterProps,
  TypewriterProps,
  FadeInProps,
  FadeStaggerProps,
  RippleButtonProps,
  RippleProps,
  FloatProps,
  ShakeProps,
  PulseGlowProps,
  PriceFlashProps,
  PriceFlashWrapperProps,
  ValueUpdateProps,
  StaggerContainerProps,
  SkeletonWaveProps,
} from './MicroAnimations';

// FormattedNumber Components
export {
  FormattedNumber,
  PriceDisplay,
  PercentChange,
  MarketCapDisplay,
  SupplyDisplay,
} from './FormattedNumber';
export type {
  FormattedNumberProps,
  PriceDisplayProps,
  PercentChangeProps,
  MarketCapDisplayProps,
  SupplyDisplayProps,
  NumberType,
} from './FormattedNumber';

// ChainBadge Components (enhanced)
export {
  ChainBadge as ChainBadgeNew,
  ChainBadgeGroup,
  ChainSelectorItem,
} from './ChainBadge';
export type {
  ChainBadgeProps as ChainBadgeNewProps,
  ChainBadgeGroupProps,
  ChainSelectorItemProps,
} from './ChainBadge';

// TokenWithChain Components
export {
  TokenWithChain,
  TokenIcon,
  TokenWithInfo,
} from './TokenWithChain';
export type {
  TokenWithChainProps,
  TokenIconProps,
  TokenWithInfoProps,
} from './TokenWithChain';
