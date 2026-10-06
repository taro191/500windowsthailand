import type { User } from '@/types'

export const DEFAULT_AVATAR_URL =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'

/** Starting wallet balance (simulated THB) for every new account. */
export const STARTING_BALANCE = 10000

/** The account a first-time visitor is signed in as. */
export const NEW_USER: User = {
  id: 'user_new_first_time',
  name: 'สมาชิกใหม่ (ผู้ใช้เริ่มต้น)',
  citizenId: '',
  phone: '',
  email: 'newuser@kapsulep.com',
  password: 'password123',
  balance: STARTING_BALANCE,
  avatarUrl: DEFAULT_AVATAR_URL,
  bio: 'ผู้สมัครใช้งานครั้งแรก ยินดีต้อนรับสู่หน้าต่างประเทศไทย 500 บาน พร้อมโควตาถือครอง 2 บาน (ไทย 1 บาน + ภูมิภาค 1 บาน)',
  isVerified: false,
  createdAt: new Date().toISOString(),
}

/** Demo administrator: can open the admin page. Log in with admin@kapsulep.com / password123. */
export const ADMIN_USER: User = {
  id: 'user_admin',
  name: 'ผู้ดูแลระบบ (Admin)',
  citizenId: '',
  phone: '',
  email: 'admin@kapsulep.com',
  password: 'password123',
  balance: 0,
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  isVerified: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  role: 'admin',
}

export const DEMO_USERS: User[] = [
  NEW_USER,
  {
    id: 'user_theera',
    name: 'อาจารย์ธีระ วงศ์ศิลป์ (ช่างภาพอิสระ)',
    citizenId: '3-5001-00234-56-7',
    phone: '081-222-3344',
    email: 'theera@photo.th',
    password: 'password123',
    balance: 18000,
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
    bio: 'ช่างภาพบันทึกวิถีชีวิตและวัดวาอารามสยามประเทศมากกว่า 25 ปี',
    isVerified: true,
    verifiedAt: '2026-01-05T10:00:00.000Z',
    createdAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'user_jeenee',
    name: 'เจ๊ณี ผัดไทยเยาวราช',
    citizenId: '1-1004-98765-43-2',
    phone: '081-992-5566',
    email: 'jeenee@padthai.th',
    password: 'password123',
    balance: 35000,
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
    bio: 'ต้นตำรับผัดไทยเตาถ่านไฟแรงเยาวราช หอมกระทะกุ้งแม่น้ำสด',
    isVerified: true,
    verifiedAt: '2026-01-10T11:30:00.000Z',
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'user_panu',
    name: 'คุณภานุ โลกใบใหญ่ (นักเดินทาง)',
    citizenId: '1-7003-88991-23-4',
    phone: '086-777-8899',
    email: 'panu@backpack.th',
    password: 'password123',
    balance: 14000,
    avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&q=80',
    bio: 'บันทึกภาพถ่ายธรรมชาติสองฝั่งทะเลไทยและภูเขาสูง',
    isVerified: false,
    createdAt: '2026-01-15T00:00:00.000Z',
  },
  ADMIN_USER,
]
