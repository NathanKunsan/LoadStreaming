import React from 'react';

// Pure SVG National Flag of Thailand (Trairanga: Red, White, Blue, White, Red)
export const ThaiFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 900 600"
    className={`inline-block border border-current/30 rounded-xs shadow-xs ${className}`}
    aria-label="Flag of Thailand"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="900" height="600" fill="#A51931" />
    <rect y="100" width="900" height="400" fill="#F4F5F8" />
    <rect y="200" width="900" height="200" fill="#2D2A4A" />
  </svg>
);

// Pure SVG National Flag of the United Kingdom (Union Jack)
export const UkFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 60 30"
    className={`inline-block border border-current/30 rounded-xs shadow-xs ${className}`}
    aria-label="Flag of United Kingdom"
    xmlns="http://www.w3.org/2000/svg"
  >
    <clipPath id="s">
      <path d="M0,0 v30 h60 v-30 z"/>
    </clipPath>
    <clipPath id="t">
      <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
    </clipPath>
    <g clipPath="url(#s)">
      <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
    </g>
  </svg>
);
