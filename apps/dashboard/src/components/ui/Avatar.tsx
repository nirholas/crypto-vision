/**
 * @fileoverview Premium Avatar Components
 * 
 * Avatar and avatar group components for user/coin images.
 * 
 * @module components/ui/Avatar
 */
'use client';

import { useState } from 'react';

export interface AvatarProps {
  src?: string;
  alt: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'circle' | 'rounded' | 'square';
  status?: 'online' | 'offline' | 'busy' | 'away';
  ring?: boolean;
  ringColor?: 'primary' | 'gain' | 'loss' | 'warning';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const variantClasses = {
  circle: 'rounded-full',
  rounded: 'rounded-xl',
  square: 'rounded-none',
};

const statusColors = {
  online: 'bg-gain',
  offline: 'bg-text-muted',
  busy: 'bg-loss',
  away: 'bg-warning',
};

const ringColors = {
  primary: 'ring-primary',
  gain: 'ring-gain',
  loss: 'ring-loss',
  warning: 'ring-warning',
};

const statusSizes = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

// Generate initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Generate a consistent color based on name
function getColorFromName(name: string): string {
  const colors = [
    'bg-primary',
    'bg-purple-500',
    'bg-pink-500',
    'bg-gain',
    'bg-cyan-500',
    'bg-warning',
    'bg-loss',
    'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({
  src,
  alt,
  name,
  size = 'md',
  variant = 'circle',
  status,
  ring = false,
  ringColor = 'primary',
  className = '',
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const displayName = name || alt;

  return (
    <div className="relative inline-flex">
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className={`
            ${sizeClasses[size]}
            ${variantClasses[variant]}
            object-cover
            ${ring ? `ring-2 ring-offset-2 ring-offset-background ${ringColors[ringColor]}` : ''}
            ${className}
          `}
        />
      ) : (
        <div
          className={`
            ${sizeClasses[size]}
            ${variantClasses[variant]}
            ${getColorFromName(displayName)}
            flex items-center justify-center font-medium text-white
            ${ring ? `ring-2 ring-offset-2 ring-offset-background ${ringColors[ringColor]}` : ''}
            ${className}
          `}
          title={alt}
        >
          {getInitials(displayName)}
        </div>
      )}
      {status && (
        <span
          className={`
            absolute bottom-0 right-0
            ${statusSizes[size]}
            ${statusColors[status]}
            ${variantClasses[variant]}
            ring-2 ring-background
          `}
        />
      )}
    </div>
  );
}

// Avatar Group
export interface AvatarGroupProps {
  avatars: Array<{ src?: string; alt: string; name?: string }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarGroup({
  avatars,
  max = 4,
  size = 'md',
  className = '',
}: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  const overlapClasses = {
    xs: '-ml-1.5',
    sm: '-ml-2',
    md: '-ml-3',
    lg: '-ml-4',
  };

  return (
    <div className={`flex items-center ${className}`}>
      {visibleAvatars.map((avatar, index) => (
        <div
          key={index}
          className={index > 0 ? overlapClasses[size] : ''}
          style={{ zIndex: visibleAvatars.length - index }}
        >
          <Avatar
            src={avatar.src}
            alt={avatar.alt}
            name={avatar.name}
            size={size}
            ring
            ringColor="primary"
          />
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={`
            ${overlapClasses[size]}
            ${sizeClasses[size]}
            rounded-full bg-surface-hover border-2 border-background
            flex items-center justify-center font-medium text-text-secondary
          `}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
