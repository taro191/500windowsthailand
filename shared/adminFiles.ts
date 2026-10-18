// Admin document library: files only admins can upload, list and download (images, zips, office
// documents). Limits and types are shared by the admin UI and the API.

export interface AdminFile {
  id: string
  /** Original file name, shown and used for downloads. */
  name: string
  ext: string
  size: number
  note: string
  uploadedBy: string
  createdAt: string
}

export const ADMIN_FILE_MAX_BYTES = 10 * 1024 * 1024

export type AdminFileKind = 'image' | 'archive' | 'document'

/** Allowed extensions with their media type and kind. */
export const ADMIN_FILE_TYPES: Record<string, { mime: string; kind: AdminFileKind }> = {
  jpg: { mime: 'image/jpeg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', kind: 'image' },
  png: { mime: 'image/png', kind: 'image' },
  webp: { mime: 'image/webp', kind: 'image' },
  gif: { mime: 'image/gif', kind: 'image' },
  zip: { mime: 'application/zip', kind: 'archive' },
  pdf: { mime: 'application/pdf', kind: 'document' },
  doc: { mime: 'application/msword', kind: 'document' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'document' },
  xls: { mime: 'application/vnd.ms-excel', kind: 'document' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'document' },
  ppt: { mime: 'application/vnd.ms-powerpoint', kind: 'document' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'document' },
  txt: { mime: 'text/plain; charset=utf-8', kind: 'document' },
  csv: { mime: 'text/csv; charset=utf-8', kind: 'document' },
}

export const ADMIN_FILE_KIND_LABELS: Record<AdminFileKind, string> = { image: 'รูปภาพ', archive: 'ไฟล์ zip', document: 'เอกสาร' }

export const adminFileExt = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '')

export const ADMIN_FILE_ACCEPT = Object.keys(ADMIN_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',')
