import { useState } from 'react'

interface AvatarProps {
  user: { name: string; avatarUrl: string }
  /** Size and border classes, e.g. "w-10 h-10 border border-rose-400". */
  className?: string
  alt?: string
}

const COLORS = [
  ['#f97316', '#e11d48'],
  ['#e11d48', '#9333ea'],
  ['#9333ea', '#4f46e5'],
  ['#0ea5e9', '#4f46e5'],
  ['#10b981', '#0891b2'],
  ['#f59e0b', '#ea580c'],
]

// Thai leading vowels (เ แ โ ใ ไ) come before the first consonant, which reads better as an initial.
const LEADING_VOWEL = /[เ-ไ]/

/** The first letter of a name, skipping Thai leading vowels: "เจ๊ณี" → "จ". */
export function nameInitial(name: string): string {
  const letter = Array.from(name.trim()).find((ch) => /[\p{L}\p{N}]/u.test(ch) && !LEADING_VOWEL.test(ch))
  return (letter ?? '?').toUpperCase()
}

/** A user's profile photo, or their initial on a colour picked from the name when they have none. */
export function Avatar({ user, className = '', alt = '' }: AvatarProps) {
  const [broken, setBroken] = useState<string | null>(null)
  if (user.avatarUrl && broken !== user.avatarUrl) {
    return <img src={user.avatarUrl} alt={alt} onError={() => setBroken(user.avatarUrl)} className={`rounded-full object-cover shrink-0 ${className}`} />
  }
  const hash = Array.from(user.name).reduce((sum, ch) => (sum * 31 + ch.codePointAt(0)!) >>> 0, 7)
  const [from, to] = COLORS[hash % COLORS.length]
  return (
    <svg viewBox="0 0 40 40" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={`rounded-full shrink-0 ${className}`}>
      <defs>
        <linearGradient id={`avatar-${hash}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#avatar-${hash})`} />
      <text x="20" y="21" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="18" fontWeight="700" fontFamily="Prompt, sans-serif">
        {nameInitial(user.name)}
      </text>
    </svg>
  )
}
