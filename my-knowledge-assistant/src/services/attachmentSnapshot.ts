/**
 * 附件 OPFS 快照（2026-10-10，方案③第一步）
 *
 * 来龙去脉：附件走 File System Access API 只存句柄不存内容，但浏览器重启会把
 * 读权限收回去（安全设计，防止网站隔天偷读文件），句柄还在、`getFile()` 却抛
 * NotAllowedError——表现就是重启后图片缩略图全部破图。
 *
 * 思路（flaviocopes 的「元数据进 IDB、字节进 OPFS、文件名用 id」模式）：
 * 上传时把文件字节抄一份进 OPFS（浏览器私有文件系统：无权限概念、重启不丢、
 * 用户看不见也不需要看见），显示读不到句柄时退快照。句柄权限恢复后对比
 * lastModified/size，原文件变过就重抄——「跟着更新」语义。
 *
 * 降级承诺：OPFS 不可用（老浏览器/配额异常）时所有函数返回 null，主流程
 * 不受影响——快照是兜底，不是依赖。PDF 附件不做快照（体积大且阅读走句柄）。
 */

// 快照统一放 OPFS 根下的这个目录，文件名 = 附件 id（元数据在 IDB，字节在这）
const SNAP_DIR = 'attachment-snapshots'

/** 快照元信息：对比原文件是否变过用（lastModified 变了 = 文件被改过） */
export interface SnapshotMeta {
  lastModified: number
  size: number
}

async function getSnapDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // TS 的 DOM lib 暂未收录 navigator.storage.getDirectory，as any 兜一层
    const root = await (navigator as any).storage?.getDirectory()
    if (!root) return null
    return await root.getDirectoryHandle(SNAP_DIR, { create: true })
  } catch {
    // OPFS 不可用：静默降级，调用方拿 null 自己走原路径
    return null
  }
}

/** 把文件字节抄进 OPFS，成功返回快照元信息（存到附件上供日后对比） */
export async function saveSnapshot(id: string, file: File): Promise<SnapshotMeta | null> {
  const dir = await getSnapDir()
  if (!dir) return null
  try {
    const fileHandle = await dir.getFileHandle(id, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(file)
    // 不 close 字节不落盘——忘了 close 重启后会读到空文件（OPFS 的经典坑）
    await writable.close()
    return { lastModified: file.lastModified, size: file.size }
  } catch (error) {
    console.error('附件快照写入失败:', error)
    return null
  }
}

/** 读快照；没有（没抄过/被清了站点数据）返回 null */
export async function readSnapshot(id: string): Promise<File | null> {
  const dir = await getSnapDir()
  if (!dir) return null
  try {
    const fileHandle = await dir.getFileHandle(id) // 不带 create：查无此文件要抛错走 catch
    return await fileHandle.getFile()
  } catch {
    return null
  }
}

/** 删快照（附件删除时同步清，免得 OPFS 里堆孤儿字节） */
export async function deleteSnapshot(id: string): Promise<void> {
  const dir = await getSnapDir()
  if (!dir) return
  try {
    await dir.removeEntry(id)
  } catch {
    // 本来就没有就当删干净了
  }
}

/**
 * 查句柄读权限。TS 类型没收录 queryPermission，动态探测：
 * 老浏览器（无此 API）返回 'granted' 让调用方直接试 getFile，失败自有 catch 兜
 */
export async function queryHandlePermission(
  handle: FileSystemFileHandle,
): Promise<'granted' | 'denied' | 'prompt'> {
  const query = (handle as any).queryPermission
  if (typeof query !== 'function') return 'granted'
  return (await query.call(handle, { mode: 'readwrite' })) as 'granted' | 'denied' | 'prompt'
}

/**
 * 请求读权限——必须在用户手势（点击）里调用，否则浏览器直接拒绝。
 * Chrome 122+ 会弹三选项，用户选「每次访问都允许」后句柄权限跨会话持久
 */
export async function requestHandlePermission(
  handle: FileSystemFileHandle,
): Promise<'granted' | 'denied' | 'prompt'> {
  const request = (handle as any).requestPermission
  if (typeof request !== 'function') return 'granted'
  try {
    return (await request.call(handle, { mode: 'readwrite' })) as 'granted' | 'denied' | 'prompt'
  } catch {
    return 'denied'
  }
}
