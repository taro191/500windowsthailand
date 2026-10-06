import type { Category, CategoryId } from '@/types'

export const CATEGORIES: Record<CategoryId, Category> = {
  street_food: { label: 'อาหาร & สตรีทฟู้ด', icon: '🍲', color: 'from-amber-600 to-orange-500' },
  travel_nature: { label: 'ท่องเที่ยว & ธรรมชาติ', icon: '🏝️', color: 'from-emerald-600 to-teal-500' },
  cafe_lifestyle: { label: 'คาเฟ่ & ไลฟ์สไตล์', icon: '☕', color: 'from-stone-600 to-amber-700' },
  arts_culture: { label: 'ศิลปะ & วัฒนธรรม', icon: '🪷', color: 'from-rose-600 to-red-500' },
  business_startup: { label: 'ธุรกิจ & ผู้ประกอบการ', icon: '💼', color: 'from-indigo-600 to-blue-500' },
  personal_memory: { label: 'ความทรงจำ & ครอบครัว', icon: '📷', color: 'from-purple-600 to-pink-500' },
}

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[]
