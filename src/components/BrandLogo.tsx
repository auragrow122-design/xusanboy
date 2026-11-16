import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
}

/**
 * Clean graduation cap logo mark without any spinner visual around it.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', size = 36 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="capGrad" x1="8" y1="14" x2="56" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#0A2E7A" />
        </linearGradient>
      </defs>
      {/* Mortarboard top */}
      <path
        d="M32 13L6 25.5L32 38L58 25.5L32 13Z"
        fill="url(#capGrad)"
      />
      {/* Cap base / crown */}
      <path
        d="M17 32.5V43.5C17 47.6 23.7 51 32 51C40.3 51 47 47.6 47 43.5V32.5L32 39.8L17 32.5Z"
        fill="#0B3B91"
      />
      {/* Subtle rim highlight */}
      <path
        d="M17 32.5L32 39.8L47 32.5"
        stroke="#60A5FA"
        strokeOpacity="0.45"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tassel cord & drop */}
      <path
        d="M50 28.5V42.5"
        stroke="#0B3B91"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle cx="50" cy="43.5" r="2.6" fill="#0B3B91" />
      <path
        d="M47.8 46.2C47.8 44.8 52.2 44.8 52.2 46.2L53 52.5C53 53.3 51.6 54 50 54C48.4 54 47 53.3 47 52.5L47.8 46.2Z"
        fill="#0A2E7A"
      />
    </svg>
  );
};
