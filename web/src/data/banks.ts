export interface Bank {
  code: string
  name: string
  /** Badge background class. */
  color: string
  text: string
}

export const BANKS: Bank[] = [
  { code: 'kbank', name: 'ธนาคารกสิกรไทย (KBANK)', color: 'bg-emerald-600', text: 'KBANK' },
  { code: 'scb', name: 'ธนาคารไทยพาณิชย์ (SCB)', color: 'bg-purple-700', text: 'SCB' },
  { code: 'bbl', name: 'ธนาคารกรุงเทพ (BBL)', color: 'bg-blue-800', text: 'BBL' },
  { code: 'ktb', name: 'ธนาคารกรุงไทย (KTB)', color: 'bg-sky-500', text: 'KTB' },
  { code: 'ttb', name: 'ธนาคารทหารไทยธนชาต (TTB)', color: 'bg-blue-600', text: 'TTB' },
  { code: 'bay', name: 'ธนาคารกรุงศรีอยุธยา (BAY)', color: 'bg-amber-600', text: 'BAY' },
  { code: 'gsb', name: 'ธนาคารออมสิน (GSB)', color: 'bg-pink-600', text: 'GSB' },
]
