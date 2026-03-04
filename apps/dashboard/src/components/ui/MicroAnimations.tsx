/**
 * @fileoverview Micro-Animation Components
 * 
 * Delightful micro-interactions and animated elements
 * for premium user experience.
 * 
 * @module components/ui/MicroAnimations
 */
'use client';

import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';

// ===========================================
// AnimatedNumber - Counts up/down with easing
// ===========================================
export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  easing?: 'linear' | 'easeOut' | 'easeInOut' | 'spring';
}

export function AnimatedNumber({
  value,
  duration = 800,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  easing = 'easeOut',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  const getEasing = useCallback((t: number): number => {
    switch (easing) {
      case 'linear':
        return t;
      case 'easeOut':
        return 1 - Math.pow(1 - t, 3);
      case 'easeInOut':
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      case 'spring':
        return 1 - Math.pow(Math.cos(t * Math.PI * 0.5), 3);
      default:
        return t;
    }
  }, [easing]);

  useEffect(() => {
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = Date.now();
    const startValue = previousValue.current;
    const difference = value - startValue;

    // Skip animation for very small changes
    if (Math.abs(difference) < 0.0001) {
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }

    const updateValue = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = getEasing(progress);
      
      setDisplayValue(startValue + difference * eased);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(updateValue);
      } else {
        setDisplayValue(value);
        previousValue.current = value;
      }
    };

    animationRef.current = requestAnimationFrame(updateValue);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, getEasing]);

  return (
    <span className={`number-mono ${className}`}>
      {prefix}{displayValue.toFixed(decimals)}{suffix}
    </span>
  );
}

// Alias for backward compatibility
export { AnimatedNumber as AnimatedCounter };
export type { AnimatedNumberProps as AnimatedCounterProps };

// ===========================================
// FadeIn - Wrapper with configurable delay and direction
// ===========================================
export interface FadeInProps {
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean; // Only animate once when entering viewport
}

export function FadeIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 400,
  className = '',
  once = true,
}: FadeInProps) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once && elementRef.current) {
            observer.unobserve(elementRef.current);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [once]);

  const directionClasses = {
    up: 'animate-fade-in-up',
    down: 'animate-fade-in-down',
    left: 'animate-fade-in-left',
    right: 'animate-fade-in-right',
    none: 'animate-fade-in',
  };

  return (
    <div
      ref={elementRef}
      className={`${isVisible ? directionClasses[direction] : 'opacity-0'} ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
}

// ===========================================
// RippleButton - Click ripple effect wrapper
// ===========================================
export interface RippleButtonProps {
  children: ReactNode;
  color?: string;
  className?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

interface RippleItem {
  x: number;
  y: number;
  id: number;
  size: number;
}

export function RippleButton({
  children,
  color = 'rgba(255, 255, 255, 0.35)',
  className = '',
  disabled = false,
  onClick,
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<RippleItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;
    const id = Date.now();

    setRipples(prev => [...prev, { x, y, id, size }]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);

    onClick?.(e);
  }, [disabled, onClick]);

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            transform: 'translate(-50%, -50%) scale(0)',
            backgroundColor: color,
            animation: 'ripple-effect 0.6s ease-out forwards',
          }}
        />
      ))}
    </div>
  );
}

// ===========================================
// PriceFlashWrapper - Flashes on value change
// ===========================================
export interface PriceFlashWrapperProps {
  children: ReactNode;
  value: number;
  className?: string;
  flashDuration?: number;
}

export function PriceFlashWrapper({
  children,
  value,
  className = '',
  flashDuration = 500,
}: PriceFlashWrapperProps) {
  const [flashClass, setFlashClass] = useState<string>('');
  const previousValue = useRef<number>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (previousValue.current !== value) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Determine direction
      const direction = value > previousValue.current ? 'up' : 'down';
      setFlashClass(direction === 'up' ? 'price-flash-up' : 'price-flash-down');
      previousValue.current = value;

      // Remove flash class after duration
      timeoutRef.current = setTimeout(() => {
        setFlashClass('');
      }, flashDuration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, flashDuration]);

  return (
    <span className={`${flashClass} ${className}`}>
      {children}
    </span>
  );
}

// ===========================================
// ValueUpdate - Bounces on value change
// ===========================================
export interface ValueUpdateProps {
  children: ReactNode;
  value: number | string;
  className?: string;
}

export function ValueUpdate({
  children,
  value,
  className = '',
}: ValueUpdateProps) {
  const [bounce, setBounce] = useState(false);
  const previousValue = useRef(value);

  useEffect(() => {
    if (previousValue.current !== value) {
      setBounce(true);
      previousValue.current = value;

      const timeout = setTimeout(() => setBounce(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [value]);

  return (
    <span className={`inline-block ${bounce ? 'value-update' : ''} ${className}`}>
      {children}
    </span>
  );
}

// ===========================================
// StaggerContainer - Staggers children animations
// ===========================================
export interface StaggerContainerProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
  as?: 'div' | 'ul' | 'ol';
}

export function StaggerContainer({
  children,
  staggerDelay = 50,
  className = '',
  as: Component = 'div',
}: StaggerContainerProps) {
  return (
    <Component 
      className={`stagger-fade-custom ${className}`}
      style={{ '--stagger-delay': `${staggerDelay}ms` } as React.CSSProperties}
    >
      {children}
    </Component>
  );
}

// ===========================================
// SkeletonWave - Enhanced skeleton loader
// ===========================================
export interface SkeletonWaveProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

export function SkeletonWave({
  width = '100%',
  height = '1rem',
  className = '',
  rounded = 'md',
}: SkeletonWaveProps) {
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={`skeleton-wave ${roundedClasses[rounded]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

// Typing Text Animation
export interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  cursor?: boolean;
  className?: string;
  onComplete?: () => void;
}

export function Typewriter({
  text,
  speed = 50,
  delay = 0,
  cursor = true,
  className = '',
  onComplete,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayText('');
    setIsComplete(false);
    
    const timeout = setTimeout(() => {
      let index = 0;
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayText(text.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
          setIsComplete(true);
          onComplete?.();
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, speed, delay, onComplete]);

  return (
    <span className={className}>
      {displayText}
      {cursor && (
        <span 
          className={`inline-block w-0.5 h-[1.1em] bg-primary ml-0.5 ${isComplete ? 'animate-pulse' : ''}`}
        />
      )}
    </span>
  );
}

// Fade Stagger - animates children with staggered delays
export interface FadeStaggerProps {
  children: ReactNode[];
  staggerDelay?: number;
  className?: string;
}

export function FadeStagger({
  children,
  staggerDelay = 100,
  className = '',
}: FadeStaggerProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <div
          key={index}
          className="animate-slide-up-fade"
          style={{ animationDelay: `${index * staggerDelay}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// Ripple Effect for buttons/cards
export interface RippleProps {
  children: ReactNode;
  color?: string;
  className?: string;
}

export function Ripple({
  children,
  color = 'rgba(255, 255, 255, 0.3)',
  className = '',
}: RippleProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples(prev => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);
  };

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute pointer-events-none animate-[ripple_0.6s_ease-out]"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
            width: '200%',
            paddingBottom: '200%',
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes ripple {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// Floating Element - gentle floating animation
export interface FloatProps {
  children: ReactNode;
  duration?: number;
  distance?: number;
  className?: string;
}

export function Float({
  children,
  duration = 3,
  distance = 10,
  className = '',
}: FloatProps) {
  return (
    <div
      className={`animate-float ${className}`}
      style={{
        animation: `float ${duration}s ease-in-out infinite`,
        '--float-distance': `${distance}px`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

// Shake Animation - for errors/attention
export interface ShakeProps {
  children: ReactNode;
  trigger?: boolean;
  className?: string;
}

export function Shake({
  children,
  trigger = false,
  className = '',
}: ShakeProps) {
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (trigger) {
      setShaking(true);
      const timeout = setTimeout(() => setShaking(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [trigger]);

  return (
    <div className={`${shaking ? 'animate-shake' : ''} ${className}`}>
      {children}
    </div>
  );
}

// Pulse Glow - attention-grabbing glow animation
export interface PulseGlowProps {
  children: ReactNode;
  color?: 'primary' | 'gain' | 'loss' | 'warning';
  active?: boolean;
  className?: string;
}

const glowColors = {
  primary: 'shadow-[0_0_20px_rgba(56,97,251,0.5)]',
  gain: 'shadow-[0_0_20px_rgba(22,199,132,0.5)]',
  loss: 'shadow-[0_0_20px_rgba(234,57,67,0.5)]',
  warning: 'shadow-[0_0_20px_rgba(247,147,26,0.5)]',
};

export function PulseGlow({
  children,
  color = 'primary',
  active = true,
  className = '',
}: PulseGlowProps) {
  return (
    <div 
      className={`
        ${active ? `animate-glow-pulse ${glowColors[color]}` : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// Price Flash - flash effect for price changes
export interface PriceFlashProps {
  children: ReactNode;
  direction?: 'up' | 'down' | null;
  className?: string;
}

export function PriceFlash({
  children,
  direction,
  className = '',
}: PriceFlashProps) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (direction) {
      setFlash(direction);
      const timeout = setTimeout(() => setFlash(null), 500);
      return () => clearTimeout(timeout);
    }
  }, [direction]);

  return (
    <span
      className={`
        transition-colors duration-500
        ${flash === 'up' ? 'price-flash-up' : ''}
        ${flash === 'down' ? 'price-flash-down' : ''}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

// Confetti - celebration effect
export function Confetti({ trigger = false }: { trigger?: boolean }) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    color: string;
    delay: number;
  }>>([]);

  useEffect(() => {
    if (trigger) {
      const colors = ['#3861FB', '#16C784', '#818CF8', '#F7931A', '#EA3943'];
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);

      const timeout = setTimeout(() => setParticles([]), 3000);
      return () => clearTimeout(timeout);
    }
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: `${particle.x}%`,
            top: '-10px',
            backgroundColor: particle.color,
            animation: `confetti-fall 2.5s ease-in forwards`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
