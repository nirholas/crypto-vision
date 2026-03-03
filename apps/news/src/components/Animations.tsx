/**
 * @fileoverview Animated Components with Framer Motion
 * 
 * Micro-animations for polished UI interactions.
 * 
 * @module components/Animations
 * 
 * @features
 * - Fade in/out transitions
 * - Slide animations
 * - Scale effects
 * - Stagger children
 * - Loading shimmer
 */
'use client';

import { type ReactNode } from 'react';

interface AnimatedProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Fade in animation using CSS
 */
export function FadeIn({ children, className = '', delay = 0 }: AnimatedProps) {
  return (
    <div
      className={`animate-fadeIn ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Slide up animation
 */
export function SlideUp({ children, className = '', delay = 0 }: AnimatedProps) {
  return (
    <div
      className={`animate-slideUp ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Scale in animation
 */
export function ScaleIn({ children, className = '', delay = 0 }: AnimatedProps) {
  return (
    <div
      className={`animate-scaleIn ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Staggered children animation
 */
interface StaggerProps {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number;
}

export function Stagger({ children, className = '', staggerDelay = 50 }: StaggerProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <div
          key={index}
          className="animate-fadeIn"
          style={{ animationDelay: `${index * staggerDelay}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/**
 * Shimmer loading effect
 */
export function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

/**
 * Pulse animation for live indicators
 */
export function Pulse({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-3 w-3 ${className}`}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
    </span>
  );
}

/**
 * Bounce animation for attention
 */
export function Bounce({ children, className = '' }: AnimatedProps) {
  return (
    <div className={`animate-bounce ${className}`}>
      {children}
    </div>
  );
}

/**
 * Spin animation for loading
 */
export function Spin({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-brand-600 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Counter animation - animates number changes
 */
interface CounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export function Counter({ value, className = '' }: CounterProps) {
  return (
    <span className={`tabular-nums ${className}`}>
      {value.toLocaleString()}
    </span>
  );
}

/**
 * Typewriter effect for text
 */
interface TypewriterProps {
  text: string;
  speed?: number;
  className?: string;
}

export function Typewriter({ text, className = '' }: TypewriterProps) {
  return (
    <span className={`inline-block overflow-hidden whitespace-nowrap border-r-2 border-current animate-typewriter ${className}`}>
      {text}
    </span>
  );
}

/**
 * Hover lift effect wrapper
 */
export function HoverLift({ children, className = '' }: AnimatedProps) {
  return (
    <div className={`transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg ${className}`}>
      {children}
    </div>
  );
}

/**
 * Hover glow effect wrapper
 */
export function HoverGlow({ children, className = '' }: AnimatedProps) {
  return (
    <div className={`transition-shadow duration-200 hover:shadow-xl hover:shadow-brand-500/20 ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// FRAMER MOTION COMPONENTS (merged from animations.tsx)
// ============================================================================

// Re-export framer-motion for convenience
export { motion, AnimatePresence } from 'framer-motion';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

// Animation variants
export const fadeInVariant: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUpVariant: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const fadeInDownVariant: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

export const fadeInLeftVariant: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const fadeInRightVariant: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const scaleInVariant: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export const slideInFromBottomVariant: Variants = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
};

export const staggerContainerVariant: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItemVariant: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Framer Motion Components
interface MotionAnimatedProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export function MotionFadeIn({ children, className, delay = 0, duration = 0.4 }: MotionAnimatedProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeInVariant}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionFadeInUp({ children, className, delay = 0, duration = 0.4 }: MotionAnimatedProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeInUpVariant}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionFadeInDown({ children, className, delay = 0, duration = 0.4 }: MotionAnimatedProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeInDownVariant}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionScaleIn({ children, className, delay = 0, duration = 0.3 }: MotionAnimatedProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={scaleInVariant}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface MotionStaggerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function MotionStaggerContainer({ children, className, staggerDelay = 0.1 }: MotionStaggerProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionStaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItemVariant} className={className}>
      {children}
    </motion.div>
  );
}

// Page Transition Wrapper
interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Card Hover Animation
interface HoverCardMotionProps {
  children: ReactNode;
  className?: string;
  scale?: number;
}

export function HoverCardMotion({ children, className, scale = 1.02 }: HoverCardMotionProps) {
  return (
    <motion.div
      whileHover={{ scale, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Button Press Animation
interface PressButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function PressButton({ children, className, onClick, disabled }: PressButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ duration: 0.15 }}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}

// Slide In Panel (for modals/sidebars)
interface SlideInPanelProps {
  children: ReactNode;
  isOpen: boolean;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
  onClose?: () => void;
}

export function SlideInPanel({
  children,
  isOpen,
  direction = 'right',
  className,
  onClose,
}: SlideInPanelProps) {
  const variants = {
    left: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
    right: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
    top: { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } },
    bottom: { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={variants[direction].initial}
            animate={variants[direction].animate}
            exit={variants[direction].exit}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={`fixed z-50 ${className}`}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Number Counter Animation
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({
  value,
  className,
  prefix = '',
  suffix = '',
}: AnimatedCounterProps) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={className}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        key={value}
      >
        {prefix}
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {value.toLocaleString()}
        </motion.span>
        {suffix}
      </motion.span>
    </motion.span>
  );
}

// Skeleton Loading Animation
interface AnimatedSkeletonProps {
  className?: string;
  count?: number;
}

export function AnimatedSkeleton({ className, count = 1 }: AnimatedSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={`bg-gray-800 rounded ${className}`}
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  );
}

// Animated Tooltip
interface AnimatedTooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function AnimatedTooltip({ children, content, position = 'top' }: AnimatedTooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <motion.div className="relative group" whileHover="hover">
      {children}
      <motion.div
        className={`absolute ${positionClasses[position]} px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50`}
        initial={{ opacity: 0, scale: 0.9 }}
        variants={{
          hover: { opacity: 1, scale: 1 },
        }}
        transition={{ duration: 0.15 }}
      >
        {content}
      </motion.div>
    </motion.div>
  );
}
