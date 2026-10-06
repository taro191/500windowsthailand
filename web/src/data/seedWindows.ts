import type { CategoryId, RegionId, WindowItem } from '@/types'
import { REGIONS_BY_ID } from './regions'
import { CATEGORY_IDS } from './categories'
import { thaiDayKey } from '@/lib/thaiTime'

export const DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1534008897995-27a23e859048?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1512553353614-82a7370096dc?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=800&q=80',
]

/** All windows of a region, empty and available. Category and province are pre-assigned per slot. */
export function createEmptyWindows(regionId: RegionId): WindowItem[] {
  const region = REGIONS_BY_ID[regionId] || REGIONS_BY_ID.thailand
  const windows: WindowItem[] = []
  for (let id = 1; id <= (region.windowCount || 500); id++) {
    const code = `${region.codePrefix}-${id.toString().padStart(3, '0')}`
    windows.push({
      id,
      code,
      region: regionId,
      title: `หน้าต่างว่าง บานที่ #${code} (${region.name})`,
      description: `หน้าต่างบานนี้ใน${region.name}ยังว่างอยู่! คุณสามารถสมัครสมาชิกและจับจองเป็นเจ้าของคนแรก (จำกัดไม่เกิน 2 บาน: ไทย 1 บาน + ภูมิภาค 1 บาน) เพื่อลงรูปภาพส่วนตัว ประชาสัมพันธ์ธุรกิจ และแก้ไขได้วันละ 1 ครั้ง`,
      imageUrl: '',
      category: CATEGORY_IDS[(id * 3) % CATEGORY_IDS.length] as CategoryId,
      province: region.provinces[(id * 7) % region.provinces.length],
      status: 'available',
      claimPrice: 500,
      ownerName: 'ยังไม่มีเจ้าของ',
      ownerId: '',
      imageUpdateHistory: [],
      viewsCount: 0,
      likesCount: 0,
      slotPosition: id,
    })
  }
  return windows
}

const daysAgo = (now: number, days: number) => new Date(now - days * 86_400_000).toISOString()

/** The three showcase windows on the Thailand board. */
export function createDemoWindows(): WindowItem[] {
  const now = Date.now()
  return [
    {
      id: 1,
      code: 'KAP-TH-001',
      region: 'thailand',
      title: 'อรุณรุ่ง ณ วัดอรุณราชวราราม',
      description:
        'ภาพถ่ายพระปรางค์วัดอรุณคู่สายน้ำเจ้าพระยา แสงทองยามเช้าสะท้อนผืนน้ำ สัญลักษณ์แห่งความสง่างามของประเทศไทย',
      imageUrl: DEMO_IMAGES[0],
      category: 'arts_culture',
      province: 'กรุงเทพมหานคร',
      ownerName: 'อาจารย์ธีระ วงศ์ศิลป์ (ช่างภาพอิสระ)',
      ownerId: 'user_theera',
      ownerCitizenId: '3-5001-00234-56-7',
      ownerPhone: '081-222-3344',
      ownerContact: '@theera_photo',
      externalLink: 'https://instagram.com',
      status: 'occupied',
      claimPrice: 500,
      claimedAt: daysAgo(now, 45),
      lastImageUpdatedAt: daysAgo(now, 12),
      imageUpdateHistory: [{ date: daysAgo(now, 12), imageUrl: DEMO_IMAGES[0], caption: 'ภาพแสงแรกวัดอรุณประจำวันนี้' }],
      viewsCount: 1420,
      likesCount: 310,
      dailyLikes: { day: thaiDayKey(), count: 12 },
      slotPosition: 1,
    },
    {
      id: 2,
      code: 'KAP-TH-002',
      region: 'thailand',
      title: 'ผัดไทยไฟแรงเตาถ่าน เยาวราช',
      description:
        'ผัดไทยสูตรเด็ดตกทอดมากกว่า 40 ปี ผัดด้วยกระทะเหล็กเตาถ่านไฟแรง กลิ่นหอมกระทะโชยเตะจมูก กุ้งแม่น้ำสดเด้งตัวโต',
      imageUrl: DEMO_IMAGES[1],
      category: 'street_food',
      province: 'กรุงเทพมหานคร',
      ownerName: 'เจ๊ณี ผัดไทยเยาวราช',
      ownerId: 'user_jeenee',
      ownerCitizenId: '1-1004-98765-43-2',
      ownerPhone: '081-992-5566',
      ownerContact: '081-992-5566',
      externalLink: 'https://facebook.com',
      status: 'occupied',
      claimPrice: 500,
      claimedAt: daysAgo(now, 50),
      lastImageUpdatedAt: daysAgo(now, 20),
      imageUpdateHistory: [{ date: daysAgo(now, 20), imageUrl: DEMO_IMAGES[1], caption: 'ผัดไทยกุ้งแม่น้ำสูตรเด็ดเยาวราช' }],
      viewsCount: 980,
      likesCount: 185,
      followersBase: 5400,
      dailyNote: { day: thaiDayKey(), text: 'วันนี้เตาถ่านเปิดถึง 5 โมงเย็น มีกุ้งแม่น้ำสด!', at: new Date(now).toISOString() },
      slotPosition: 2,
    },
    {
      id: 3,
      code: 'KAP-TH-003',
      region: 'thailand',
      title: 'ผืนน้ำมรกต อ่าวไร่เลย์และถ้ำพระนาง',
      description:
        'บันทึกภาพหน้าผาหินปูนสูงตระหง่านและหาดทรายขาวละเอียด จ.กระบี่ จุดหมายในฝันของนักปีนผาและผู้หลงใหลทะเลอันดามัน',
      imageUrl: DEMO_IMAGES[2],
      category: 'travel_nature',
      province: 'กระบี่',
      ownerName: 'คุณภานุ โลกใบใหญ่ (นักเดินทาง)',
      ownerId: 'user_panu',
      ownerCitizenId: '1-7003-88991-23-4',
      ownerPhone: '086-777-8899',
      ownerContact: '@panu_backpack',
      externalLink: 'https://youtube.com',
      status: 'for_resale',
      claimPrice: 500,
      resalePrice: 2800,
      claimedAt: daysAgo(now, 60),
      previousOwnerId: 'user_theera',
      previousOwnerHistory: [
        { ownerId: 'user_theera', transferredAt: new Date(now - 4 * 3_600_000).toISOString(), type: 'resale' },
      ],
      ownerChangedAt: new Date(now - 4 * 3_600_000).toISOString(),
      ownerChangeKind: 'new',
      lastImageUpdatedAt: daysAgo(now, 45),
      imageUpdateHistory: [{ date: daysAgo(now, 45), imageUrl: DEMO_IMAGES[2], caption: 'วิวอ่าวไร่เลย์ยามสาย' }],
      viewsCount: 1750,
      likesCount: 420,
      slotPosition: 3,
    },
  ]
}

/** Initial board for a region: empty windows, with the demo windows on the Thailand board. */
export function createInitialWindows(regionId: RegionId): WindowItem[] {
  const windows = createEmptyWindows(regionId)
  if (regionId !== 'thailand') return windows
  const demo = new Map(createDemoWindows().map((w) => [w.id, w]))
  return windows.map((w) => demo.get(w.id) || w)
}
