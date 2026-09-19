/** 契约常量生成器：模型与源声明类型。 */

/** 文档读取抽象；测试以内存实现替换文件系统。 */
export interface DocReader {
  read(relativePath: string): string;
}

/** 章节定位：按标题层级与标题包含串定位。 */
export interface SectionSelector {
  readonly file: string;
  readonly headingLevel: 2 | 3 | 4;
  readonly heading: string;
}

/** 表格定位：在章节内按表头锚点定位表格。 */
export interface TableSelector extends SectionSelector {
  readonly headerAnchor: string;
}

export interface CapabilityTableSelector extends TableSelector {
  readonly capabilityColumnHeader: string;
  readonly permissionColumnHeader: string;
}

export interface CapabilitySourceConfig {
  readonly table: CapabilityTableSelector;
  readonly declaredCountFile: string;
  readonly declaredCountPattern: RegExp;
}

export type PermissionVocabTable =
  | {
      readonly kind: 'domain-scope';
      readonly table: TableSelector & {
        readonly domainColumnHeader: string;
        readonly scopeColumnHeader: string;
      };
    }
  | {
      readonly kind: 'permission-id';
      readonly table: TableSelector & {
        readonly permissionColumnHeader: string;
      };
    };

export interface PermissionSourceConfig {
  readonly catalog: TableSelector & { readonly permissionColumnHeader: string };
  readonly vocabulary: readonly PermissionVocabTable[];
  readonly capabilityMappingCheck: CapabilityTableSelector;
}

export interface EventSourceConfig {
  readonly reservedTable: TableSelector;
  readonly declarations: readonly string[];
}

export interface ErrorSourceConfig extends SectionSelector {
  readonly note: string;
}

export interface ContractSources {
  readonly capability: CapabilitySourceConfig;
  readonly permission: PermissionSourceConfig;
  readonly event: EventSourceConfig;
  readonly errors: readonly ErrorSourceConfig[];
}

export interface SourceRef {
  /** 相对文档库的路径。 */
  readonly file: string;
  /** 章节标题或说明。 */
  readonly section: string;
}

export interface CapabilityEntry {
  readonly id: string;
  readonly permissions: readonly string[];
}

export interface PermissionEntry {
  readonly id: string;
}

export interface EventEntry {
  readonly id: string;
  readonly domain: string;
}

export interface ErrorCodeEntry {
  readonly code: string;
}

export interface ReservedEventDomain {
  readonly domain: string;
  /** 文档声明的事件数；`null` 表示不公开、不计数（如 `internal`）。 */
  readonly declaredCount: number | null;
}

/** 由文档显式声明、用于校验的事实。 */
export interface DeclaredFacts {
  readonly capabilityCount: number;
  readonly reservedDomains: readonly ReservedEventDomain[];
  readonly permissionVocabulary: readonly string[];
}

export interface ContractModel {
  readonly capabilities: readonly CapabilityEntry[];
  readonly permissions: readonly PermissionEntry[];
  readonly events: readonly EventEntry[];
  readonly errorCodes: readonly ErrorCodeEntry[];
  readonly facts: DeclaredFacts;
  readonly sources: {
    readonly capability: readonly SourceRef[];
    readonly permission: readonly SourceRef[];
    readonly event: readonly SourceRef[];
    readonly error: readonly SourceRef[];
  };
}

export interface ValidationIssue {
  readonly rule: string;
  readonly message: string;
}

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

export interface ContractBuild {
  readonly model: ContractModel;
  readonly issues: readonly ValidationIssue[];
  readonly files: readonly GeneratedFile[];
}
