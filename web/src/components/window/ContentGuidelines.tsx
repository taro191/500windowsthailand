/** Rule 5: what images and text may be posted (Thai law and PDPA). */
export const CONTENT_GUIDELINES = [
  { title: 'ไม่อนาจาร:', detail: 'ห้ามภาพเปลือย ภาพลามก หรือเนื้อหาที่มีนัยทางเพศ' },
  { title: 'ไม่มีความรุนแรง:', detail: 'ห้ามภาพเลือด ความโหดร้าย การทารุณกรรม หรือการทำร้ายตนเอง' },
  { title: 'ไม่เหยียดหรือสร้างความเกลียดชัง:', detail: 'ห้ามเหยียดเชื้อชาติ ศาสนา เพศ หรือความพิการ' },
  { title: 'ไม่ละเมิดข้อมูลส่วนบุคคล (PDPA):', detail: 'ห้ามลงข้อมูลผู้อื่นโดยไม่ได้รับความยินยอม' },
  { title: 'ไม่ผิดกฎหมายไทย:', detail: 'ห้ามหมิ่นประมาท การพนัน ยาเสพติด หรืออาวุธ' },
  { title: 'ไม่ละเมิดลิขสิทธิ์:', detail: 'ต้องเป็นภาพของคุณเองหรือได้รับอนุญาต' },
]

export function ContentGuidelines() {
  return (
    <ul className="space-y-1.5 text-[11px] leading-relaxed text-stone-400 font-light">
      {CONTENT_GUIDELINES.map((rule) => (
        <li key={rule.title}>
          • <strong className="text-stone-200">{rule.title}</strong> {rule.detail}
        </li>
      ))}
    </ul>
  )
}
