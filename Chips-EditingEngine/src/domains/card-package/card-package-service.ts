import type { Client } from "chips-sdk";
import { parseYamlLite, stringifyYamlLite, type YamlValue } from "./yaml-lite";

export type CardDocumentMode = "edit" | "view";

export interface AvailableBaseCardType {
  pluginId: string;
  pluginName: string;
  cardType: string;
  templatePath: string;
}

export interface CardStructureNode {
  id: string;
  type: string;
}

export interface AddBaseCardInput {
  cardFile: string;
  cardType: string;
  insertIndex: number;
}

export interface AddBaseCardResult {
  nodeId: string;
  cardType: string;
  pluginId: string;
  title: string;
}

export interface ReorderBaseCardInput {
  cardFile: string;
  nodeId: string;
  targetIndex: number;
}

export interface RemoveBaseCardInput {
  cardFile: string;
  nodeId: string;
}

export interface SetDocumentModeInput {
  cardFile: string;
  mode: CardDocumentMode;
}

export interface CardPackageService {
  listAvailableBaseCardTypes(): Promise<AvailableBaseCardType[]>;
  addBaseCard(input: AddBaseCardInput): Promise<AddBaseCardResult>;
  removeBaseCard(input: RemoveBaseCardInput): Promise<void>;
  reorderBaseCard(input: ReorderBaseCardInput): Promise<void>;
  setDocumentMode(input: SetDocumentModeInput): Promise<void>;
}

type YamlObject = Record<string, YamlValue>;

interface CardMutationContext {
  stageRoot: string;
  packageDir: string;
  metadataPath: string;
  structurePath: string;
  outputZipPath: string;
  metadata: YamlObject;
  structure: YamlObject;
}

const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asYamlObject(value: unknown): YamlObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as YamlObject) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asCardDocumentMode(value: unknown): CardDocumentMode {
  return value === "view" ? "view" : "edit";
}

function normalizeSlashes(pathname: string): string {
  return pathname.replace(/\\/g, "/");
}

function dirname(pathname: string): string {
  const normalized = normalizeSlashes(pathname);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) {
    return index === 0 ? "/" : ".";
  }
  return normalized.slice(0, index);
}

function basename(pathname: string): string {
  const normalized = normalizeSlashes(pathname);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function joinPath(...parts: string[]): string {
  const joined = parts
    .filter((part) => part.length > 0)
    .map((part, index) => {
      const normalized = normalizeSlashes(part);
      if (index === 0) {
        return normalized.replace(/\/+$/g, "");
      }
      return normalized.replace(/^\/+|\/+$/g, "");
    })
    .filter((part) => part.length > 0)
    .join("/");

  if (parts[0]?.startsWith("/")) {
    return `/${joined.replace(/^\/+/, "")}`;
  }

  return joined;
}

function randomId(length: number): string {
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);
  let result = "";
  for (const value of values) {
    result += BASE62_ALPHABET[value % BASE62_ALPHABET.length];
  }
  return result;
}

function readStructureNodes(structure: Record<string, unknown>): CardStructureNode[] {
  const nodes = Array.isArray(structure.structure) ? structure.structure : [];
  return nodes
    .map((item) => {
      const record = asRecord(item);
      const id = asString(record.id);
      const type = asString(record.type);
      if (!id || !type) {
        return null;
      }
      return { id, type } satisfies CardStructureNode;
    })
    .filter((item): item is CardStructureNode => item !== null);
}

function writeStructureNodes(structure: YamlObject, nodes: CardStructureNode[]): YamlObject {
  const manifest = asYamlObject(structure.manifest);
  return {
    ...structure,
    structure: nodes.map((node) => ({ id: node.id, type: node.type })),
    manifest: {
      ...manifest,
      card_count: nodes.length,
    },
  };
}

function readTitleFromConfig(config: Record<string, unknown>, nodeId: string): string {
  return asString(config.title) ?? nodeId;
}

export function readDocumentMode(ast: { metadata?: Record<string, unknown> } | null | undefined): CardDocumentMode {
  const metadata = asRecord(ast?.metadata);
  const editorState = asRecord(metadata.editor_state);
  return asCardDocumentMode(editorState.mode);
}

export function readDocumentStructureNodes(ast: { structure?: Record<string, unknown> } | null | undefined): CardStructureNode[] {
  return readStructureNodes(asRecord(ast?.structure));
}

function createMutationPaths(cardFile: string) {
  const fileName = basename(cardFile);
  const directory = dirname(cardFile);
  const stageRoot = joinPath(directory, `.chips-editing-engine-stage-${Date.now()}-${randomId(6)}`);
  return {
    stageRoot,
    packageDir: joinPath(stageRoot, "package"),
    outputDir: joinPath(stageRoot, "output"),
    outputZipPath: joinPath(stageRoot, "output", fileName),
    metadataPath: joinPath(stageRoot, "package", ".card", "metadata.yaml"),
    structurePath: joinPath(stageRoot, "package", ".card", "structure.yaml"),
  };
}

async function withCardMutation<T>(client: Client, cardFile: string, mutate: (ctx: CardMutationContext) => Promise<T>): Promise<T> {
  const paths = createMutationPaths(cardFile);

  await client.file.mkdir(paths.packageDir, { recursive: true });
  await client.file.mkdir(paths.outputDir, { recursive: true });
  await client.zip.extract(cardFile, paths.packageDir);

  try {
    const metadataText = await client.file.read(paths.metadataPath, { encoding: "utf-8" });
    const structureText = await client.file.read(paths.structurePath, { encoding: "utf-8" });
    const metadata = parseYamlLite(String(metadataText));
    const structure = parseYamlLite(String(structureText));

    const ctx: CardMutationContext = {
      stageRoot: paths.stageRoot,
      packageDir: paths.packageDir,
      metadataPath: paths.metadataPath,
      structurePath: paths.structurePath,
      outputZipPath: paths.outputZipPath,
      metadata,
      structure,
    };

    const result = await mutate(ctx);
    await client.file.write(ctx.metadataPath, `${stringifyYamlLite(ctx.metadata)}\n`, { encoding: "utf-8" });
    await client.file.write(ctx.structurePath, `${stringifyYamlLite(ctx.structure)}\n`, { encoding: "utf-8" });
    await client.zip.compress(ctx.packageDir, ctx.outputZipPath);
    await client.file.move(ctx.outputZipPath, cardFile, { overwrite: true });
    return result;
  } finally {
    await client.file.delete(paths.stageRoot, { recursive: true }).catch(() => undefined);
  }
}

function markMetadataModified(metadata: YamlObject, mode?: CardDocumentMode): YamlObject {
  const nextEditorState = {
    ...asYamlObject(metadata.editor_state),
    ...(mode ? { mode } : {}),
  };
  return {
    ...metadata,
    editor_state: nextEditorState,
    modified_at: new Date().toISOString(),
  };
}

async function loadTemplateConfig(client: Client, templatePath: string, cardType: string, nodeId: string): Promise<YamlObject> {
  const raw = await client.file.read(templatePath, { encoding: "utf-8" });
  const parsed = parseYamlLite(String(raw));
  return {
    ...parsed,
    id: asString(parsed.id) ?? nodeId,
    card_type: asString(parsed.card_type) ?? cardType,
  };
}

async function resolveBaseCardTypeMap(client: Client): Promise<Map<string, AvailableBaseCardType>> {
  const plugins = await client.plugin.query({ type: "card" });
  const result = new Map<string, AvailableBaseCardType>();

  for (const plugin of plugins) {
    if (!plugin.enabled) {
      continue;
    }
    const capabilities = Array.isArray(plugin.capabilities) ? plugin.capabilities : [];
    for (const capability of capabilities) {
      if (typeof capability !== "string" || capability.trim().length === 0) {
        continue;
      }
      const templatePath = joinPath(plugin.installPath, "templates", "default-card-config.yaml");
      const hasTemplate = await client.file.exists(templatePath);
      if (!hasTemplate) {
        continue;
      }
      result.set(capability, {
        pluginId: plugin.id,
        pluginName: plugin.name,
        cardType: capability,
        templatePath,
      });
    }
  }

  return result;
}

function findNodeIndex(nodes: CardStructureNode[], nodeId: string): number {
  return nodes.findIndex((node) => node.id === nodeId);
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, length - 1));
}

export function createCardPackageService(client: Client): CardPackageService {
  return {
    async listAvailableBaseCardTypes() {
      return [...(await resolveBaseCardTypeMap(client)).values()].sort((left, right) =>
        left.pluginName.localeCompare(right.pluginName, "zh-CN"),
      );
    },
    async addBaseCard(input) {
      const typeMap = await resolveBaseCardTypeMap(client);
      const selectedType = typeMap.get(input.cardType);
      if (!selectedType) {
        throw new Error(`No card template is available for type: ${input.cardType}`);
      }

      return withCardMutation(client, input.cardFile, async (ctx) => {
        const nodes = readStructureNodes(ctx.structure);
        let nodeId = randomId(10);
        while (nodes.some((node) => node.id === nodeId)) {
          nodeId = randomId(10);
        }

        const config = await loadTemplateConfig(client, selectedType.templatePath, input.cardType, nodeId);
        const nextNodes = [...nodes];
        const insertIndex = Math.max(0, Math.min(input.insertIndex, nextNodes.length));
        nextNodes.splice(insertIndex, 0, { id: nodeId, type: input.cardType });
        ctx.structure = writeStructureNodes(ctx.structure, nextNodes);
        ctx.metadata = markMetadataModified(ctx.metadata);

        const contentPath = joinPath(ctx.packageDir, "content", `${nodeId}.yaml`);
        await client.file.write(contentPath, `${stringifyYamlLite(config)}\n`, { encoding: "utf-8" });

        return {
          nodeId,
          cardType: input.cardType,
          pluginId: selectedType.pluginId,
          title: readTitleFromConfig(config, nodeId),
        } satisfies AddBaseCardResult;
      });
    },
    async removeBaseCard(input) {
      await withCardMutation(client, input.cardFile, async (ctx) => {
        const nodes = readStructureNodes(ctx.structure);
        const nextNodes = nodes.filter((node) => node.id !== input.nodeId);
        if (nextNodes.length === nodes.length) {
          throw new Error(`Base card node not found: ${input.nodeId}`);
        }
        ctx.structure = writeStructureNodes(ctx.structure, nextNodes);
        ctx.metadata = markMetadataModified(ctx.metadata);
        const contentPath = joinPath(ctx.packageDir, "content", `${input.nodeId}.yaml`);
        if (await client.file.exists(contentPath)) {
          await client.file.delete(contentPath);
        }
      });
    },
    async reorderBaseCard(input) {
      await withCardMutation(client, input.cardFile, async (ctx) => {
        const nodes = readStructureNodes(ctx.structure);
        const currentIndex = findNodeIndex(nodes, input.nodeId);
        if (currentIndex < 0) {
          throw new Error(`Base card node not found: ${input.nodeId}`);
        }
        const nextNodes = [...nodes];
        const [targetNode] = nextNodes.splice(currentIndex, 1);
        if (!targetNode) {
          throw new Error(`Base card node not found: ${input.nodeId}`);
        }
        nextNodes.splice(clampIndex(input.targetIndex, nextNodes.length + 1), 0, targetNode);
        ctx.structure = writeStructureNodes(ctx.structure, nextNodes);
        ctx.metadata = markMetadataModified(ctx.metadata);
      });
    },
    async setDocumentMode(input) {
      await withCardMutation(client, input.cardFile, async (ctx) => {
        ctx.metadata = markMetadataModified(ctx.metadata, input.mode);
      });
    },
  };
}
