'use client';

import { useRef, useState, useEffect } from 'react';

interface ProtocolImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Protocol Image with error handling
 * Attaches error handler via ref after mount to avoid RSC serialization issues
 */
export default function ProtocolImage({ src, alt, className = '' }: ProtocolImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const handleError = () => {
      setShowFallback(true);
    };

    // Check if image already failed to load (can happen if cached as broken)
    if (img.complete && img.naturalWidth === 0) {
      setShowFallback(true);
      return;
    }

    img.addEventListener('error', handleError);
    return () => img.removeEventListener('error', handleError);
  }, [src]);

  if (!src || showFallback) {
    return (
      <div 
        className={`${className} bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center`}
        role="img"
        aria-label={alt}
      >
        <span className="text-gray-500 text-xs font-bold">
          {alt?.charAt(0)?.toUpperCase() || '?'}
        </span>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
