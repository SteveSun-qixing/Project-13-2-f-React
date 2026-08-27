import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as yaml from 'js-yaml';
import * as unzipper from 'unzipper';
import type {
  CardUnpackResult,
  CardMetadata,
  CardStructure,
  ResourceFile,
} from '../types/card';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';

/** ZIP 文件魔数（前 4 字节） */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * 验证文件是否为合法 ZIP
 */
async function validateZipMagic(filePath: string): Promise<void> {
  const fd = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(4);
  fs.readSync(fd, header, 0, 4, 0);
  fs.closeSync(fd);

  if (!header.equals(ZIP_MAGIC)) {
    throw AppError.badRequest(ErrorCode.FILE_CORRUPT, 'File is not a valid ZIP archive');
  }
}

/**
 * 解压 ZIP 到临时目录，并防止路径穿越攻击
 * @returns 临时目录路径
 */
async function extractZip(filePath: string, tempDir: string): Promise<void> {
  const realTempDir = fs.realpathSync(tempDir);
  const writePromises: Promise<void>[] = [];

  await fs
    .createReadStream(filePath)
    .pipe(unzipper.Parse())
    .on('entry', (entry: unzipper.Entry) => {
      const entryPath = entry.path;
      
      // 过滤掉 Mac 的无效文件
      if (entryPath.includes('__MACOSX') || entryPath.includes('.DS_Store')) {
        entry.autodrain();
        return;
      }

      const destPath = path.resolve(realTempDir, entryPath);

      // 路径穿越检查
      if (!destPath.startsWith(realTempDir + path.sep) && destPath !== realTempDir) {
        entry.autodrain();
        return;
      }

      if (entry.type === 'Directory') {
        fs.mkdirSync(destPath, { recursive: true });
        entry.autodrain();
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        const writer = fs.createWriteStream(destPath);
        entry.pipe(writer);
        writePromises.push(new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        }));
      }
    })
    .promise();

  // 等待所有文件都完全写入磁盘
  await Promise.all(writePromises);

  // 检查是否存在顶层包装目录（例如 ZIP 内部只有一个文件夹包着所有内容）
  const topEntries = fs.readdirSync(realTempDir);
  if (topEntries.length === 1) {
    const topPath = path.join(realTempDir, topEntries[0]);
    if (fs.statSync(topPath).isDirectory() && !topEntries[0].startsWith('.')) {
      // 发现顶层包装，将内部内容全部上移
      const subEntries = fs.readdirSync(topPath);
      for (const sub of subEntries) {
        fs.renameSync(path.join(topPath, sub), path.join(realTempDir, sub));
      }
      fs.rmdirSync(topPath);
    }
  }
}

/**
 * 读取并解析 YAML 文件
 */
function parseYamlFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw AppError.badRequest(ErrorCode.FILE_CORRUPT, `Required file missing: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content) as T;
}

function normalizeCardPath(relativePath: string): string {
  return path.posix.normalize(relativePath.replace(/\\/g, '/')).replace(/^\.\/+/, '');
}

function isStructuralCardFile(relativePath: string): boolean {
  const normalizedPath = normalizeCardPath(relativePath);
  if (
    normalizedPath === '.card/metadata.yaml' ||
    normalizedPath === '.card/structure.yaml' ||
    normalizedPath === '.card/cover.html'
  ) {
    return true;
  }

  return normalizedPath.startsWith('content/') && normalizedPath.endsWith('.yaml');
}

/**
 * 枚举卡片中的所有非结构配置文件资源
 */
export function enumerateResourceFiles(tempDir: string): ResourceFile[] {
  const result: ResourceFile[] = [];
  const stack = [tempDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = normalizeCardPath(path.relative(tempDir, absolutePath));
      if (isStructuralCardFile(relativePath)) {
        continue;
      }

      const stat = fs.statSync(absolutePath);
      result.push({
        relativePath,
        absolutePath,
        size: stat.size,
        filename: path.basename(relativePath),
      });
    }
  }

  result.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en'));
  return result;
}

/**
 * 读取 content/ 目录下所有 YAML 文件
 */
function readContentFiles(tempDir: string): Map<string, Record<string, unknown>> {
  const contentDir = path.join(tempDir, 'content');
  const map = new Map<string, Record<string, unknown>>();

  if (!fs.existsSync(contentDir)) return map;

  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith('.yaml'));
  for (const file of files) {
    const id = path.basename(file, '.yaml');
    const obj = parseYamlFile<Record<string, unknown>>(path.join(contentDir, file));
    map.set(id, obj);
  }

  return map;
}

/**
 * 解包 .card 文件
 * @param cardFilePath 本地 .card 文件绝对路径
 * @returns CardUnpackResult（调用方负责在 finally 中删除 tempDir）
 */
export async function unpackCard(cardFilePath: string): Promise<CardUnpackResult> {
  // 验证 ZIP 魔数
  await validateZipMagic(cardFilePath);

  // 创建临时目录
  const tempDir = path.join(os.tmpdir(), `ccps-card-${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // 解压
    await extractZip(cardFilePath, tempDir);

    // 验证必需目录
    const cardConfigDir = path.join(tempDir, '.card');
    if (!fs.existsSync(cardConfigDir)) {
      throw AppError.badRequest(ErrorCode.FILE_CORRUPT, 'Invalid .card file: missing .card/ directory');
    }

    // 解析元数据
    const metadataRaw = parseYamlFile<Record<string, any>>(path.join(cardConfigDir, 'metadata.yaml'));
    const metadataId = metadataRaw?.id || metadataRaw?.card_id;
    const metadataName = metadataRaw?.name || metadataRaw?.title;
    
    if (!metadataId || !metadataName) {
      console.error('[card-unpack] Invalid metadata.yaml content:', metadataRaw);
      throw AppError.badRequest(ErrorCode.FILE_CORRUPT, `Invalid metadata.yaml: missing id or name. Found keys: ${metadataRaw ? Object.keys(metadataRaw).join(', ') : 'null'}`);
    }
    
    const metadata = metadataRaw as CardMetadata;
    metadata.id = metadataId;
    metadata.name = metadataName;

    // 解析结构
    const structure = parseYamlFile<CardStructure>(path.join(cardConfigDir, 'structure.yaml'));
    if (!Array.isArray(structure?.structure)) {
      throw AppError.badRequest(ErrorCode.FILE_CORRUPT, 'Invalid structure.yaml: structure array missing');
    }

    // 枚举资源文件
    const resourceFiles = enumerateResourceFiles(tempDir);

    // 读取内容配置文件
    const contentMap = readContentFiles(tempDir);

    // 读取封面 HTML（若存在）
    const coverHtmlPath = path.join(cardConfigDir, 'cover.html');
    const coverHtml = fs.existsSync(coverHtmlPath)
      ? fs.readFileSync(coverHtmlPath, 'utf-8')
      : undefined;

    return {
      tempDir,
      metadata,
      structure,
      resourceFiles,
      contentMap,
      coverHtml,
    };
  } catch (err) {
    // 出错则立即清理
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }
}
