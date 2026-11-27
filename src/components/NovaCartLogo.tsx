import React from 'react';

interface NovaCartLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showTagline?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: 28, titleClass: 'text-base', taglineClass: 'text-[10px]' },
  md: { icon: 32, titleClass: 'text-xl', taglineClass: 'text-[10px]' },
  lg: { icon: 38, titleClass: 'text-2xl', taglineClass: 'text-[11px]' },
};

export function NovaCartLogo({
  variant = 'light',
  size = 'md',
  showText = true,
  showTagline = false,
  className = '',
}: NovaCartLogoProps) {
  const { icon, titleClass, taglineClass } = SIZE_MAP[size];
  const isDarkSurface = variant === 'dark';

  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none ${className}`}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Geometric shopping bag silhouette with integrated N monogram & orange spark */}
        <rect
          width="64"
          height="64"
          rx="16"
          fill={isDarkSurface ? '#FAF8F5' : '#141416'}
        />
        <path
          d="M23.5 22V18.5C23.5 14.0817 27.0817 10.5 31.5 10.5H32.5C36.9183 10.5 40.5 14.0817 40.5 18.5V22"
          stroke={isDarkSurface ? '#141416' : '#FAF8F5'}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M16 23.5C16 21.8431 17.3431 20.5 19 20.5H45C46.6569 20.5 48 21.8431 48 23.5L50.4 48.1C50.625 50.415 48.806 52.5 46.48 52.5H17.52C15.194 52.5 13.375 50.415 13.6 48.1L16 23.5Z"
          fill={isDarkSurface ? '#141416' : '#FAF8F5'}
        />
        <path
          d="M24.5 43.5V28.5L39.5 43.5V28.5"
          stroke={isDarkSurface ? '#FAF8F5' : '#141416'}
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="44.5" cy="23.5" r="4.5" fill="#F97316" />
      </svg>

      {showText && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display font-bold tracking-tight ${titleClass} ${
              isDarkSurface ? 'text-white' : 'text-[#141416]'
            }`}
          >
            Nova<span className="text-[#F97316]">Cart</span>
          </span>
          {showTagline && (
            <span
              className={`font-sans font-medium tracking-wide mt-1 ${taglineClass} ${
                isDarkSurface ? 'text-white/65' : 'text-[#5C5B57]'
              }`}
            >
              Everything you love. One place.
            </span>
          )}
        </span>
      )}
    </span>
  );
}
