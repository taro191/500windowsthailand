import { useEffect, useRef, useState } from 'react'
import { Download, FileArchive, FileText, FolderOpen, Loader2, Pencil, Search, Trash2, Upload } from 'lucide-react'
import {
  ADMIN_FILE_ACCEPT,
  ADMIN_FILE_KIND_LABELS,
  ADMIN_FILE_MAX_BYTES,
  ADMIN_FILE_TYPES,
  adminFileExt,
  type AdminFile,
  type AdminFileKind,
} from '@shared/adminFiles'
import { deleteFile, downloadFile, filePreviewUrl, loadFiles, updateFileNote, uploadFile } from '@/lib/adminApi'
import type { AdminPageProps } from '../adminData'
import { Badge, Button, Callout, Card, DataTable, inputClass, thaiDateTime, type Tone } from '../ui'

const MB = 1024 * 1024
const fileSize = (bytes: number) => (bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const KIND_TONES: Record<AdminFileKind, Tone> = { image: 'info', archive: 'warning', document: 'primary' }

function Thumb({ file }: { file: AdminFile }) {
  const kind = ADMIN_FILE_TYPES[file.ext]?.kind
  if (kind === 'image') return <img src={filePreviewUrl(file.id)} alt="" loading="lazy" className="w-12 h-12 rounded object-cover border border-black/10 bg-[#f4f6f9]" />
  const Icon = kind === 'archive' ? FileArchive : FileText
  return (
    <span className="w-12 h-12 rounded border border-black/10 bg-[#f4f6f9] flex flex-col items-center justify-center text-[#6c757d]">
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-bold uppercase leading-none mt-0.5">{file.ext}</span>
    </span>
  )
}

export function FilesPage({ notify }: AdminPageProps) {
  const [files, setFiles] = useState<AdminFile[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<AdminFileKind | 'all'>('all')
  const input = useRef<HTMLInputElement>(null)

  const load = async () => {
    const result = await loadFiles()
    if (!result.success) return setError(result.error)
    setFiles(result.files)
  }
  useEffect(() => {
    load()
  }, [])

  const upload = async (list: FileList | null) => {
    const picked = [...(list ?? [])]
    if (input.current) input.current.value = ''
    if (!picked.length) return
    // Check everything first so nothing half-uploads because of one bad file.
    const problem = picked
      .map((f) =>
        !(adminFileExt(f.name) in ADMIN_FILE_TYPES)
          ? `${f.name}: ไม่รองรับไฟล์ชนิดนี้`
          : f.size > ADMIN_FILE_MAX_BYTES
            ? `${f.name}: ใหญ่เกิน ${ADMIN_FILE_MAX_BYTES / MB} MB`
            : '',
      )
      .filter(Boolean)
    if (problem.length) return setError(problem.join(' · '))

    setBusy('upload')
    setError('')
    const failed: string[] = []
    for (const [i, file] of picked.entries()) {
      setProgress(picked.length > 1 ? `กำลังอัปโหลด ${i + 1}/${picked.length}: ${file.name}` : `กำลังอัปโหลด ${file.name}`)
      const result = await uploadFile(file, note)
      if (!result.success) failed.push(`${file.name}: ${result.error}`)
    }
    setBusy('')
    setProgress('')
    if (failed.length) setError(failed.join(' · '))
    const done = picked.length - failed.length
    if (done) {
      notify(`อัปโหลดแล้ว ${done} ไฟล์`)
      setNote('')
    }
    await load()
  }

  const run = async (key: string, action: () => Promise<{ success: true } | { success: false; error: string }>, done?: string) => {
    setBusy(key)
    const result = await action()
    setBusy('')
    if (!result.success) {
      notify(result.error, 'error')
      return false
    }
    if (done) notify(done)
    return true
  }

  const editNote = async (file: AdminFile) => {
    const next = window.prompt(`คำอธิบายของ ${file.name}`, file.note)
    if (next === null || next === file.note) return
    if (await run(`note:${file.id}`, () => updateFileNote(file.id, next), 'บันทึกคำอธิบายแล้ว')) await load()
  }

  const remove = async (file: AdminFile) => {
    if (!window.confirm(`ลบไฟล์ "${file.name}" ถาวร?`)) return
    if (await run(`delete:${file.id}`, () => deleteFile(file.id), `ลบ "${file.name}" แล้ว`)) await load()
  }

  const q = query.trim().toLowerCase()
  const shown = (files ?? []).filter(
    (f) =>
      (kind === 'all' || ADMIN_FILE_TYPES[f.ext]?.kind === kind) &&
      (!q || f.name.toLowerCase().includes(q) || f.note.toLowerCase().includes(q) || f.uploadedBy.toLowerCase().includes(q)),
  )
  const total = (files ?? []).reduce((sum, f) => sum + f.size, 0)

  return (
    <>
      <Callout tone="info" title="คลังเอกสารของผู้ดูแล">
        เก็บไฟล์ที่ใช้ภายในทีม เช่น สัญญา ใบเสร็จ รูปภาพ หรือไฟล์ zip · ไฟล์ละไม่เกิน {ADMIN_FILE_MAX_BYTES / MB} MB · ดาวน์โหลดได้เฉพาะผู้ดูแลระบบ ·
        รองรับ {Object.keys(ADMIN_FILE_TYPES).join(', ')}
      </Callout>

      {error && (
        <Callout tone="danger" title="ทำรายการไม่สำเร็จ">
          {error}
        </Callout>
      )}

      <Card title="อัปโหลดไฟล์" icon={Upload} outline="success">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className={inputClass}
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="คำอธิบาย (ไม่บังคับ) เช่น สัญญาเช่าพื้นที่ ปี 2569"
            aria-label="คำอธิบายไฟล์"
          />
          <Button tone="success" disabled={!!busy} onClick={() => input.current?.click()} className="shrink-0 justify-center">
            {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} เลือกไฟล์และอัปโหลด
          </Button>
          <input ref={input} type="file" multiple accept={ADMIN_FILE_ACCEPT} className="hidden" onChange={(e) => upload(e.target.files)} />
        </div>
        {progress && <p className="text-sm text-[#6c757d] mt-2">{progress}</p>}
      </Card>

      <Card
        title={`ไฟล์ทั้งหมด${files ? ` (${files.length} ไฟล์ · ${fileSize(total)})` : ''}`}
        icon={FolderOpen}
        outline="primary"
        tools={
          <>
            <select className={`${inputClass} !w-auto`} value={kind} onChange={(e) => setKind(e.target.value as AdminFileKind | 'all')} aria-label="ชนิดไฟล์">
              <option value="all">ทุกชนิด</option>
              {(Object.keys(ADMIN_FILE_KIND_LABELS) as AdminFileKind[]).map((k) => (
                <option key={k} value={k}>
                  {ADMIN_FILE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6c757d]" />
              <input className={`${inputClass} !pl-8 !w-48`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาไฟล์" aria-label="ค้นหาไฟล์" />
            </div>
          </>
        }
        flush
      >
        {!files ? (
          <div className="flex items-center gap-2 text-[#6c757d] p-6">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดไฟล์…
          </div>
        ) : (
          <DataTable head={['', 'ชื่อไฟล์', 'ชนิด', 'ขนาด', 'อัปโหลด', '']} empty={files.length ? 'ไม่พบไฟล์ที่ค้นหา' : 'ยังไม่มีไฟล์ — กด "เลือกไฟล์และอัปโหลด" ด้านบน'}>
            {shown.map((file) => {
              const k = ADMIN_FILE_TYPES[file.ext]?.kind ?? 'document'
              return (
                <tr key={file.id}>
                  <td className="w-16">
                    <Thumb file={file} />
                  </td>
                  <td className="min-w-[220px]">
                    <div className="font-bold break-all">{file.name}</div>
                    {file.note && <small className="block text-[#6c757d]">{file.note}</small>}
                  </td>
                  <td>
                    <Badge tone={KIND_TONES[k]}>{ADMIN_FILE_KIND_LABELS[k]}</Badge>
                  </td>
                  <td className="whitespace-nowrap">{fileSize(file.size)}</td>
                  <td className="whitespace-nowrap">
                    {thaiDateTime(file.createdAt)}
                    <small className="block text-[#6c757d]">{file.uploadedBy}</small>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <div className="inline-flex gap-1">
                      <Button size="sm" tone="primary" outline disabled={!!busy} onClick={() => run(`dl:${file.id}`, () => downloadFile(file))}>
                        {busy === `dl:${file.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} ดาวน์โหลด
                      </Button>
                      <Button size="sm" tone="secondary" outline disabled={!!busy} onClick={() => editNote(file)} title="แก้คำอธิบาย">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" tone="danger" outline disabled={!!busy} onClick={() => remove(file)} title="ลบไฟล์">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </DataTable>
        )}
      </Card>
    </>
  )
}
