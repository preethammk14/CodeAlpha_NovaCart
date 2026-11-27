import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { sanitizeImageUrl } from '../lib/format';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  loading?: 'lazy' | 'eager';
}

export function ProductImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
  loading = 'lazy',
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const safeSrc = sanitizeImageUrl(src || '');

  useEffect(() => {
    setHasError(false);
  }, [safeSrc]);

  if (!safeSrc || hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F3EFE9] via-[#EFEAE2] to-[#E5DDD2] text-[#5C5B57] p-4 text-center">
        <Package className="w-7 h-7 mb-1.5 text-[#EA580C]/70" />
        <span className="text-[11px] font-medium leading-snug line-clamp-2 max-w-[180px]">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={loading}
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
