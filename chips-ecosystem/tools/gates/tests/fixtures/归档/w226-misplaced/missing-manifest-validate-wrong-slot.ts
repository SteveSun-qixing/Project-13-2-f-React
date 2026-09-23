/** 脏生成物夹具配套的最小清单校验器：只查存在性，保证负例命中面集中在文件正文。 */
export function validateManifest(manifest: unknown): readonly string[] {
  const record = manifest as {
    id?: unknown;
    version?: unknown;
    runtime?: { targets?: unknown };
  } | null;
  const errors: string[] = [];
  if (!record || typeof record.id !== 'string') {
    errors.push('缺 id');
  }
  if (!record || typeof record.version !== 'string') {
    errors.push('缺 version');
  }
  if (!record || !record.runtime || !Array.isArray(record.runtime.targets)) {
    errors.push('缺 runtime.targets');
  }
  return errors;
}
