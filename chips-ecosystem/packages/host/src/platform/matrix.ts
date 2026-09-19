import {
  PAL_FACET_PORT_KEYS,
  PAL_FACETS,
  type IPalCapabilityMatrix,
  type IPalHost,
  type IPalPorts,
  type IShellInfo,
  type PalFacet,
} from './contracts/index.js';
import { PalBootstrapError } from './errors.js';

/**
 * 能力矩阵构建与壳自检。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动自检）、§4.4（矩阵生成）、§5.1（三层判定）。
 *
 * @remarks
 * 矩阵按端口实现的真实存在性生成或校验，不由平台名字符串推断；分面为 `false` 时对应端口
 * 必须缺席，分面为 `true` 时对应端口必须存在。
 */

/**
 * 按端口集合推导能力矩阵；分面 `true` 当且仅当对应端口存在。
 *
 * @param ports 端口集合（`storage` 为必备端口，不参与矩阵）。
 */
export function buildCapabilityMatrix(ports: Partial<IPalPorts>): IPalCapabilityMatrix {
  const matrix = {} as Record<PalFacet, boolean>;
  for (const facet of PAL_FACETS) {
    matrix[facet] = ports[PAL_FACET_PORT_KEYS[facet]] !== undefined;
  }
  return matrix;
}

/**
 * 校验能力矩阵与端口集合一致。
 *
 * @param matrix 壳声明（或按实现推导）的能力矩阵。
 * @param ports 端口集合。
 * @throws {PalBootstrapError} 声明可用但缺端口、或存在端口未声明时抛出。
 */
export function validateCapabilityMatrix(matrix: IPalCapabilityMatrix, ports: Partial<IPalPorts>): void {
  for (const facet of PAL_FACETS) {
    const portKey = PAL_FACET_PORT_KEYS[facet];
    const present = ports[portKey] !== undefined;
    if (matrix[facet] !== present) {
      throw new PalBootstrapError('能力矩阵与端口实现不一致，终止壳启动', {
        facet,
        portKey,
        declared: matrix[facet],
        present,
      });
    }
  }
}

/**
 * 组装并自检 PAL 宿主。
 *
 * @param info 壳信息。
 * @param matrix 壳声明矩阵；必须与 `ports` 的实际实现一致。
 * @param ports 端口集合。
 * @throws {PalBootstrapError} `storage` 端口缺失或矩阵与端口集合不一致时抛出。
 */
export function assemblePalHost(info: IShellInfo, matrix: IPalCapabilityMatrix, ports: Partial<IPalPorts>): IPalHost {
  if (ports.storage === undefined) {
    throw new PalBootstrapError('PAL 宿主缺少必备的 storage 端口', { shell: info.shell });
  }
  validateCapabilityMatrix(matrix, ports);
  return { info, matrix, ports: ports as IPalPorts };
}

/**
 * 校验外部构造的 PAL 宿主矩阵与端口集合一致。
 *
 * @param host 已构造的 PAL 宿主。
 * @throws {PalBootstrapError} 不一致时抛出（声明可用但缺端口、或存在端口未声明）。
 */
export function validatePalHost(host: IPalHost): void {
  validateCapabilityMatrix(host.matrix, host.ports);
  if (host.ports.storage === undefined) {
    throw new PalBootstrapError('PAL 宿主缺少必备的 storage 端口', { shell: host.info.shell });
  }
}
