import type { Region, RegionId } from './types'

export const REGIONS: Region[] = [
  {
    id: 'thailand',
    name: 'หน้าต่างประเทศไทย',
    englishName: 'Thailand Master Windows',
    codePrefix: 'KAP-TH',
    icon: '🇹🇭',
    description:
      'หน้าต่างของประเทศ 500 บาน "ประกาศให้โลกรู้ ฉันอยู่ตรงนี้" รวบรวมเรื่องราว ผู้คน กิจการ และความทรงจำตัวแทนแห่งสยามประเทศ',
    provinces: [
      'กรุงเทพมหานคร', 'เชียงใหม่', 'ภูเก็ต', 'กระบี่', 'เชียงราย', 'น่าน', 'สุราษฎร์ธานี', 'ขอนแก่น',
      'ชลบุรี', 'พระนครศรีอยุธยา', 'กาญจนบุรี', 'อุดรธานี', 'อุบลราชธานี', 'นครราชสีมา', 'ประจวบคีรีขันธ์', 'จันทบุรี',
    ],
    gradient: 'from-amber-400 via-amber-500 to-amber-600',
    accentColor: 'text-amber-300',
    windowCount: 500,
    isCoreHeart: true,
  },
  {
    id: 'north',
    name: 'ภาคเหนือ',
    englishName: 'Northern Thailand',
    codePrefix: 'KAP-N-TH',
    icon: '🏔️',
    description: 'ดินแดนล้านนา ขุนเขา ทะเลหมอก ไร่ชา กาแฟอาราบิก้า และวิถีชีวิตสโลว์ไลฟ์',
    provinces: [
      'เชียงใหม่', 'เชียงราย', 'แม่ฮ่องสอน', 'ลำปาง', 'ลำพูน', 'น่าน', 'พะเยา', 'แพร่', 'อุตรดิตถ์',
      'สุโขทัย', 'พิษณุโลก', 'ตาก', 'กำแพงเพชร', 'พิจิตร', 'นครสวรรค์', 'อุทัยธานี', 'เพชรบูรณ์',
    ],
    gradient: 'from-emerald-500 to-teal-400',
    accentColor: 'text-emerald-400',
    windowCount: 500,
  },
  {
    id: 'central',
    name: 'ภาคกลาง',
    englishName: 'Central Thailand',
    codePrefix: 'KAP-C-TH',
    icon: '🏛️',
    description: 'ศูนย์กลางมหานคร ลุ่มน้ำเจ้าพระยา วัดวาอาราม มรดกกรุงเก่า และสตรีทฟู้ดระดับโลก',
    provinces: [
      'กรุงเทพมหานคร', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร', 'สมุทรสงคราม', 'พระนครศรีอยุธยา', 'อ่างทอง',
      'ลพบุรี', 'สิงห์บุรี', 'ชัยนาท', 'สระบุรี', 'นครนายก', 'นครปฐม', 'สุพรรณบุรี',
    ],
    gradient: 'from-amber-500 to-yellow-400',
    accentColor: 'text-amber-400',
    windowCount: 500,
  },
  {
    id: 'northeast',
    name: 'ภาคอีสาน',
    englishName: 'Northeastern Thailand',
    codePrefix: 'KAP-NE-TH',
    icon: '🪕',
    description: 'ดินแดนที่ราบสูง มนต์เสน่ห์หมอลำ ริมฝั่งโขง อารยธรรมขอมโบราณ และรสชาติแซ่บนัว',
    provinces: [
      'ขอนแก่น', 'นครราชสีมา', 'อุดรธานี', 'อุบลราชธานี', 'บุรีรัมย์', 'สุรินทร์', 'ร้อยเอ็ด', 'ศรีสะเกษ', 'สกลนคร', 'นครพนม',
      'ชัยภูมิ', 'เลย', 'มหาสารคาม', 'กาฬสินธุ์', 'ยโสธร', 'หนองคาย', 'หนองบัวลำภู', 'มุกดาหาร', 'อำนาจเจริญ', 'บึงกาฬ',
    ],
    gradient: 'from-orange-500 to-rose-400',
    accentColor: 'text-orange-400',
    windowCount: 500,
  },
  {
    id: 'west',
    name: 'ภาคตะวันตก',
    englishName: 'Western Thailand',
    codePrefix: 'KAP-W-TH',
    icon: '🏞️',
    description: 'ทิวเขาตะนาวศรี สายน้ำแคว สะพานมอญ ป่ามรดกโลก และหาดทรายชายฝั่งหัวหิน-ชะอำ',
    provinces: ['กาญจนบุรี', 'เพชรบุรี', 'ประจวบคีรีขันธ์', 'ราชบุรี', 'ตาก'],
    gradient: 'from-lime-500 to-emerald-400',
    accentColor: 'text-lime-400',
    windowCount: 500,
  },
  {
    id: 'east',
    name: 'ภาคตะวันออก',
    englishName: 'Eastern Thailand',
    codePrefix: 'KAP-E-TH',
    icon: '🌊',
    description: 'ชายฝั่งทะเลอ่าวไทย เกาะช้าง ระยอง พัทยา เมืองผลไม้ทุเรียน และเขตเศรษฐกิจสร้างสรรค์',
    provinces: ['ชลบุรี', 'ระยอง', 'จันทบุรี', 'ตราด', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'สระแก้ว'],
    gradient: 'from-cyan-500 to-blue-400',
    accentColor: 'text-cyan-400',
    windowCount: 500,
  },
  {
    id: 'south',
    name: 'ภาคใต้',
    englishName: 'Southern Thailand',
    codePrefix: 'KAP-S-TH',
    icon: '🏝️',
    description: 'อัญมณีสองฝั่งทะเลอันดามันและอ่าวไทย เขาหินปูน หาดทรายขาว ดำน้ำ และวัฒนธรรมปักษ์ใต้',
    provinces: [
      'ภูเก็ต', 'กระบี่', 'สุราษฎร์ธานี', 'พังงา', 'นครศรีธรรมราช', 'สงขลา', 'ตรัง',
      'สตูล', 'ชุมพร', 'ระนอง', 'พัทลุง', 'ปัตตานี', 'ยะลา', 'นราธิวาส',
    ],
    gradient: 'from-sky-500 to-indigo-400',
    accentColor: 'text-sky-400',
    windowCount: 500,
  },
]

export const REGIONS_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, Region>

export const REGION_IDS: RegionId[] = ['thailand', 'north', 'central', 'northeast', 'west', 'east', 'south']
