/**
 * PDF 阅读器持久化（2026-10-10）
 *
 * 来龙去脉：PDFView 的 PDF 来源有三个——工具栏上传（blob URL）、知识库详情页
 * 点「阅读」（FSAA 句柄经 PDFStore 中转）。三个都是「本次会话用完即走」：
 * blob URL 刷新就没，句柄重启后读权限被浏览器收回（FSAA 的安全设计）。
 * 表现就是重启项目后阅读器空空如也，得重新上传。
 *
 * 思路（与 attachmentSnapshot.ts 同款：字节进 OPFS、元数据进 localStorage）：
 * 每次成功打开 PDF 都把字节抄一份进 OPFS（浏览器私有文件系统，无权限概念、
 * 重启不丢），下次进阅读器若没有新任务（consume() 为空）就自动恢复上次的。
 * 语义是「记住上次在读的」——永远只存一份，新打开的覆盖旧的。
 *
 * 与附件快照的边界：附件快照按附件 id 存多份、给缩略图兜底；这里全局只存
 * 一份、给阅读器续读。PDF 附件本身仍不做快照（体积大，阅读走句柄）。
 *
 * 降级承诺：OPFS 不可用（老浏览器/配额异常）时所有函数静默返回 null，
 * 阅读器退回「每次手动上传」的原状——持久化是增强，不是依赖。
 */

// 统一放 OPFS 根下的这个目录，固定文件名（只记住最后一份）
const PDF_DIR = 'pdf-reader'
const PDF_FILE = 'last.pdf'

// 文件名这类展示信息体积小、结构简单，放 localStorage 就够，不必动 IDB
const META_KEY = 'pdfReader:lastMeta'

/** 恢复时给用户看的信息（文件名） */
export interface LastPdfMeta {
  name: string
  savedAt: number
}

async function getPdfDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // TS 的 DOM lib 暂未收录 navigator.storage.getDirectory，as any 兜一层（同 attachmentSnapshot）
    const root = await (navigator as any).storage?.getDirectory()
    if (!root) return null
    return await root.getDirectoryHandle(PDF_DIR, { create: true })
  } catch {
    // OPFS 不可用：静默降级
    return null
  }
}

/** 把当前打开的 PDF 字节抄进 OPFS，并记下文件名（每次打开覆盖写） */
export async function saveLastPdf(file: File): Promise<void> {
  const dir = await getPdfDir()
  if (!dir) return
  try {
    const fileHandle = await dir.getFileHandle(PDF_FILE, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(file)
    // 不 close 字节不落盘——OPFS 的经典坑（详见 attachmentSnapshot.ts 同注释）
    await writable.close()
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ name: file.name, savedAt: Date.now() } satisfies LastPdfMeta),
    )
  } catch (error) {
    // 大文件可能撞配额：持久化失败不影响本次阅读，只留排查线索
    console.error('PDF 持久化写入失败:', error)
  }
}

/** 读上次保存的 PDF；没存过/被清了站点数据返回 null */
export async function loadLastPdf(): Promise<{ file: File; name: string } | null> {
  const dir = await getPdfDir()
  if (!dir) return null
  try {
    const fileHandle = await dir.getFileHandle(PDF_FILE) // 不带 create：查无此文件要抛错走 catch
    const file = await fileHandle.getFile()
    let name = '上次阅读的 PDF'
    try {
      const meta = JSON.parse(localStorage.getItem(META_KEY) || '') as LastPdfMeta
      if (meta?.name) name = meta.name
    } catch {
      // 元数据丢了不影响正文恢复，用默认名
    }
    return { file, name }
  } catch {
    return null
  }
}
