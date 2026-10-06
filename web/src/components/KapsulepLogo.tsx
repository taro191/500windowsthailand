import { useId, useState } from 'react'
import logoUrl from '@/assets/kapsulep-logo.jpg'

interface KapsulepLogoProps {
  size?: number
  className?: string
  showGlow?: boolean
  /** Use the photo logo; falls back to the vector mark if it fails to load. */
  useImage?: boolean
}

export function KapsulepLogo({ size = 40, className = '', showGlow = false, useImage = true }: KapsulepLogoProps) {
  const [imageFailed, setImageFailed] = useState(false)
  // useId() contains characters that are not valid inside an SVG url(#...) reference.
  const gradientId = `kapsulep-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {showGlow && (
        <div
          className="absolute -inset-1.5 rounded-full blur-md opacity-70 pointer-events-none transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(circle, rgba(249,115,22,0.65) 0%, rgba(244,63,94,0.55) 45%, rgba(168,85,247,0.4) 80%, transparent 100%)',
          }}
        />
      )}
      {useImage && !imageFailed ? (
        <img
          src={logoUrl}
          alt="Kapsulep Logo"
          onError={() => setImageFailed(true)}
          className="w-full h-full rounded-full object-cover shadow-lg transition-transform duration-300 hover:scale-105 border border-white/10"
        />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full rounded-full shadow-lg transition-transform duration-300 hover:scale-105 border border-white/10"
        >
          <defs>
            <linearGradient id={gradientId} x1="24" y1="20" x2="176" y2="182" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ff6b2b" />
              <stop offset="28%" stopColor="#f43f5e" />
              <stop offset="58%" stopColor="#d946ef" />
              <stop offset="82%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="98" fill={`url(#${gradientId})`} />
          <rect
            x="58"
            y="42"
            width="84"
            height="116"
            rx="42"
            fill="none"
            stroke="#ffffff"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="92" y="82" width="16" height="22" rx="8" fill="#ffffff" />
          <rect x="83" y="114" width="34" height="10" rx="5" fill="#ffffff" />
        </svg>
      )}
    </div>
  )
}
