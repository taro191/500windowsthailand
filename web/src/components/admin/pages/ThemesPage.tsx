import { useEffect, useRef, useState } from 'react'
import { Download, Eye, Loader2, Palette, Save, Trash2, Upload } from 'lucide-react'
import type { RegionId } from '@shared/types'
import { REGIONS } from '@shared/regions'
import { deleteTheme, downloadTheme, loadThemes, saveThemeAssignments, uploadTheme } from '@/lib/adminApi'
import { DEFAULT_THEME_VARIABLES, emptyThemeAssignments, THEME_LIMITS, type ThemeAssignments, type ThemeInfo } from '@/lib/themes'
import type { AdminPageProps } from '../adminData'
import { Badge, Button, Callout, Card, DataTable, inputClass, thaiDateTime } from '../ui'

type Scope = { key: 'main' | 'promo' | RegionId; label: string; hint: string; empty: string }

const SCOPES: Scope[] = [
  { key: 'main', label: 'เว็บหลัก', hint: 'ทุกหน้าของเว็บ (ไม่รวมหน้าแอดมิน)', empty: 'ค่าเริ่มต้น (ดีไซน์เดิม)' },
  ...REGIONS.map((r) => ({ key: r.id, label: `${r.icon} ${r.name}`, hint: 'เฉพาะตอนเปิดภูมิภาคนี้', empty: 'ใช้ธีมเว็บหลัก' })),
  { key: 'promo', label: 'หน้าโปรโมชัน', hint: 'หน้าที่เปิดจากช่องโฆษณา และฟอร์มขอโปรโมท', empty: 'ค่าเริ่มต้น (ดีไซน์เดิม)' },
]

const getScope = (a: ThemeAssignments, key: Scope['key']) => (key === 'main' ? a.main : key === 'promo' ? a.promo : (a.regions[key] ?? null))
const setScope = (a: ThemeAssignments, key: Scope['key'], id: string | null): ThemeAssignments =>
  key === 'main' ? { ...a, main: id } : key === 'promo' ? { ...a, promo: id } : { ...a, regions: { ...a.regions, [key]: id ?? undefined } }

/** Theme actually shown for a scope: regions fall back to the main theme. */
const effective = (a: ThemeAssignments, key: Scope['key']) => getScope(a, key) ?? (key !== 'main' && key !== 'promo' ? a.main : null)

const SWATCHES = ['--theme-page-bg', '--color-amber-400', '--color-rose-400', '--color-purple-500', '--color-emerald-400', '--promo-page-button-from']
const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

export function ThemesPage({ notify }: AdminPageProps) {
  const [themes, setThemes] = useState<ThemeInfo[] | null>(null)
  const [saved, setSaved] = useState<ThemeAssignments>(emptyThemeAssignments)
  const [draft, setDraft] = useState<ThemeAssignments>(emptyThemeAssignments)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const load = async () => {
    const result = await loadThemes()
    if (!result.success) return setError(result.error)
    setThemes(result.themes)
    setSaved(result.assignments)
    setDraft(result.assignments)
  }
  useEffect(() => {
    load()
  }, [])

  const run = async (key: string, action: () => Promise<{ success: true } | { success: false; error: string }>, done?: string) => {
    setBusy(key)
    setError('')
    const result = await action()
    setBusy('')
    if (!result.success) {
      setError(result.error)
      notify(result.error, 'error')
      return false
    }
    if (done) notify(done)
    return true
  }

  const upload = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    if (!/\.zip$/i.test(file.name)) return setError('กรุณาเลือกไฟล์ .zip')
    if (file.size > THEME_LIMITS.zipBytes) return setError(`ไฟล์ธีมใหญ่เกิน ${THEME_LIMITS.zipBytes / 1024 / 1024} MB`)
    let name = ''
    const ok = await run('upload', async () => {
      const result = await uploadTheme(file)
      if (result.success) name = result.theme.name
      return result
    })
    if (ok) {
      notify(`อัปโหลดธีม "${name}" แล้ว เลือกใช้ได้ในตารางด้านบน`)
      await load()
    }
  }

  const save = async () => {
    const ok = await run('save', () => saveThemeAssignments(draft), 'บันทึกธีมแล้ว ผู้ใช้จะเห็นธีมใหม่เมื่อเปิดหรือรีเฟรชหน้าเว็บ')
    if (ok) await load()
  }

  const remove = async (theme: ThemeInfo) => {
    if (!window.confirm(`ลบธีม "${theme.name}"? ไฟล์ของธีมจะถูกลบถาวร (ดาวน์โหลดเก็บไว้ก่อนได้)`)) return
    if (await run(`delete:${theme.id}`, () => deleteTheme(theme.id), `ลบธีม "${theme.name}" แล้ว`)) await load()
  }

  const usedAt = (id: string) => SCOPES.filter((s) => getScope(saved, s.key) === id).map((s) => s.label)
  const themeName = (id: string | null) => (id ? (themes?.find((t) => t.id === id)?.name ?? 'ไม่พบธีม') : 'ค่าเริ่มต้น')
  const changed = JSON.stringify(draft) !== JSON.stringify(saved)

  if (!themes) {
    return error ? (
      <Callout tone="danger" title="โหลดธีมไม่สำเร็จ">
        {error}
      </Callout>
    ) : (
      <div className="flex items-center gap-2 text-[#6c757d] p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดธีม…
      </div>
    )
  }

  return (
    <>
      <Callout tone="info" title="ธีมทำงานอย่างไร">
        ธีมคือไฟล์ .zip ที่มี <code>theme.json</code> (สี พื้นหลัง ฟอนต์) และ <code>theme.css</code> กับโฟลเดอร์ <code>assets/</code> (ไม่บังคับ) ·
        วิธีแก้: กด "ดาวน์โหลด" ธีมที่ใช้อยู่ → แตก zip แล้วแก้ไฟล์ → บีบอัดเป็น zip → อัปโหลดกลับในคลังธีม → กด "ดูตัวอย่าง" → เลือกใช้แล้วกดบันทึก ·
        รายละเอียดตัวแปรอยู่ในไฟล์ README.txt ในธีมที่ดาวน์โหลด
      </Callout>

      {error && (
        <Callout tone="danger" title="ทำรายการไม่สำเร็จ">
          {error}
        </Callout>
      )}

      <Card
        title="ธีมที่ใช้งาน"
        icon={Palette}
        outline="primary"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[#6c757d]">{changed ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ตรงกับที่ใช้อยู่บนเว็บ'}</span>
            <div className="flex gap-2">
              <Button tone="secondary" outline disabled={!changed || !!busy} onClick={() => setDraft(saved)}>
                ยกเลิก
              </Button>
              <Button disabled={!changed || !!busy} onClick={save}>
                {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึกธีม
              </Button>
            </div>
          </div>
        }
        flush
      >
        <DataTable head={['ส่วนของเว็บ', 'ธีม', 'ธีมที่แสดงจริง', '']}>
          {SCOPES.map((scope) => {
            const shown = effective(saved, scope.key)
            return (
              <tr key={scope.key}>
                <td>
                  <div className="font-bold">{scope.label}</div>
                  <small className="text-[#6c757d]">{scope.hint}</small>
                </td>
                <td className="min-w-[220px]">
                  <select
                    className={inputClass}
                    value={getScope(draft, scope.key) ?? ''}
                    onChange={(e) => setDraft(setScope(draft, scope.key, e.target.value || null))}
                    aria-label={`ธีมของ${scope.label}`}
                  >
                    <option value="">{scope.empty}</option>
                    {themes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.version ? ` v${t.version}` : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="whitespace-nowrap">{themeName(shown)}</td>
                <td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    tone="secondary"
                    outline
                    disabled={!!busy}
                    onClick={() => run(`dl:${scope.key}`, () => downloadTheme(shown ?? 'default'))}
                    title="ดาวน์โหลดธีมที่แสดงอยู่ตอนนี้เป็นไฟล์ zip เพื่อนำไปแก้ไข"
                  >
                    {busy === `dl:${scope.key}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} ดาวน์โหลดธีมที่ใช้
                  </Button>
                </td>
              </tr>
            )
          })}
        </DataTable>
      </Card>

      <Card
        title="คลังธีม"
        icon={Upload}
        outline="success"
        tools={
          <>
            <Button size="sm" tone="secondary" outline disabled={!!busy} onClick={() => run('dl:default', () => downloadTheme('default'))}>
              <Download className="w-3.5 h-3.5" /> ธีมต้นแบบ (ดีไซน์เดิม)
            </Button>
            <Button size="sm" tone="success" disabled={!!busy} onClick={() => fileInput.current?.click()}>
              {busy === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} อัปโหลดธีม (.zip)
            </Button>
            <input ref={fileInput} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </>
        }
        flush
      >
        <DataTable head={['ธีม', 'สี', 'ไฟล์', 'อัปโหลด', 'ใช้งานที่', '']} empty="ยังไม่มีธีมที่อัปโหลด — ดาวน์โหลดธีมต้นแบบไปแก้ แล้วอัปโหลดกลับมา">
          {themes.map((theme) => {
            const used = usedAt(theme.id)
            return (
              <tr key={theme.id}>
                <td className="min-w-[200px]">
                  <div className="font-bold">
                    {theme.name} {theme.version && <span className="font-normal text-[#6c757d]">v{theme.version}</span>}
                  </div>
                  {theme.description && <small className="block text-[#6c757d]">{theme.description}</small>}
                  {theme.author && <small className="block text-[#6c757d]">โดย {theme.author}</small>}
                </td>
                <td>
                  <div className="flex gap-1">
                    {SWATCHES.map((name) => (
                      <span
                        key={name}
                        title={`${name}: ${theme.variables[name] ?? `${DEFAULT_THEME_VARIABLES[name]} (ค่าเดิม)`}`}
                        className="w-5 h-5 rounded border border-black/20"
                        style={{ background: theme.variables[name] ?? DEFAULT_THEME_VARIABLES[name] }}
                      />
                    ))}
                  </div>
                  <small className="text-[#6c757d]">
                    {Object.keys(theme.variables).length} ตัวแปร{theme.stylesheet ? ' · มี CSS' : ''}
                  </small>
                </td>
                <td className="whitespace-nowrap">
                  {theme.files} ไฟล์ · {fileSize(theme.size)}
                </td>
                <td className="whitespace-nowrap">
                  {thaiDateTime(theme.createdAt)}
                  <small className="block text-[#6c757d]">{theme.createdBy}</small>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {used.length ? used.map((label) => <Badge key={label} tone="success">{label}</Badge>) : <span className="text-[#6c757d]">-</span>}
                  </div>
                </td>
                <td className="text-right whitespace-nowrap">
                  <div className="inline-flex gap-1">
                    <Button size="sm" tone="info" outline onClick={() => window.open(`/?theme-preview=${encodeURIComponent(theme.id)}`, '_blank', 'noopener')}>
                      <Eye className="w-3.5 h-3.5" /> ดูตัวอย่าง
                    </Button>
                    <Button size="sm" tone="secondary" outline disabled={!!busy} onClick={() => run(`dl:${theme.id}`, () => downloadTheme(theme.id))}>
                      <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
                    </Button>
                    <Button
                      size="sm"
                      tone="danger"
                      outline
                      disabled={!!busy || used.length > 0}
                      title={used.length ? 'ธีมนี้กำลังใช้งานอยู่ เปลี่ยนธีมก่อนลบ' : undefined}
                      onClick={() => remove(theme)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> ลบ
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </DataTable>
      </Card>
    </>
  )
}
