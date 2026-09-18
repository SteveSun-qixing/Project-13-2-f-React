import { createError } from '../../../src/shared/errors';
import type { PALStorage } from '../../pal/src';

/**
 * Office 加密文档解密（ECMA-376 agile encryption，OLE/CFB 容器）。
 *
 * 浏览器端无系统加密能力，加密容器解析与密钥派生属于 Node 域系统能力，
 * 由 Host 承载：`office.crypto.decrypt { filePath, password } → { bytes }`。
 * 算法实现复用 GenOffice 同款 officecrypto-tool（MIT）。
 */

export interface OfficeCryptoDecryptInput {
  filePath: string;
  password: string;
}

/** 判定文件是否为加密的 OLE/CFB 容器（ZIP 魔数 PK\x03\x04 与 OLE 魔数区分）。 */
export const isEncryptedContainer = (bytes: Uint8Array): boolean => {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return false;
  }
  if (bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return true;
  }
  return false;
};

export const decryptOfficeFile = async (
  input: OfficeCryptoDecryptInput,
  storage: Pick<PALStorage, 'readFile'>,
): Promise<{ bytes: Uint8Array }> => {
  if (!input?.filePath || typeof input.password !== 'string') {
    throw createError('INVALID_ARGUMENT', 'office.crypto.decrypt: filePath and password are required.');
  }
  const raw = await storage.readFile(input.filePath);
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
  if (!isEncryptedContainer(bytes)) {
    throw createError('OFFICE_CRYPTO_FAILED', 'office.crypto.decrypt: file is not an encrypted OLE container.');
  }
  // officecrypto-tool 以 CommonJS 提供，Host 主进程为 Node 环境，运行时动态 require。
  const officeCrypto = require('officecrypto-tool') as {
    decrypt: (buffer: Buffer, options: { password: string }) => Promise<Buffer>;
  };
  try {
    const decrypted = await officeCrypto.decrypt(Buffer.from(bytes), { password: input.password });
    return { bytes: new Uint8Array(decrypted) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password|decrypt|key|verify/i.test(message)) {
      throw createError('OFFICE_CRYPTO_WRONG_PASSWORD', 'office.crypto.decrypt: incorrect password.');
    }
    throw createError('OFFICE_CRYPTO_FAILED', `office.crypto.decrypt: ${message}`);
  }
};
