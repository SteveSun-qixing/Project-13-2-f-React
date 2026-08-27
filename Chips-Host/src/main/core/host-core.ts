import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { Kernel } from '../../../packages/kernel/src';
import type { PALAdapter } from '../../../packages/pal/src';
import { CardService, CardSessionService, createBasecardAdapter, createDefaultCoverHtml, collectCoverResourceReferences } from '../../../packages/card-service/src';
import { CardInfoService } from '../../../packages/card-info-service/src';
import { BoxService, BoxSessionService } from '../../../packages/box-service/src';
import { WorkspaceService } from '../../../packages/workspace-service/src';
import { StoreZipService } from '../../../packages/zip-service/src';
import { StructuredLogger } from '../../shared/logger';
import { createBridgeForKernel, HOST_INTERNAL_PERMISSIONS } from '../../preload/create-bridge';
import { PluginRuntime } from '../../runtime';
import { RuntimeClient } from '../../renderer/runtime-client';
import { registerHostSchemas } from '../services/register-schemas';
import { registerHostServices } from '../services/register-host-services';
import { loadElectronModule } from '../electron/electron-loader';
import {
  CHIPS_RENDER_DOCUMENT_SCHEME,
} from '../electron/render-document-protocol';
import type { LogEntry } from '../../shared/types';
import {
  ensureBuiltInPlugins,
  ensureBuiltInPluginShortcuts,
  resolveDefaultBuiltInPluginRoots,
  type BuiltInPluginDefinition
} from './built-in-plugins';

export interface HostCoreOptions {
  pal: PALAdapter;
  workspacePath?: string;
  builtInPluginRoots?: string[];
  builtInPlugins?: BuiltInPluginDefinition[];
}

export class HostCore {
  public readonly kernel: Kernel;
  public readonly pal: PALAdapter;
  public readonly logger: StructuredLogger;
  public readonly workspacePath: string;
  public readonly runtime: PluginRuntime;
  private readonly builtInPluginRoots: string[];
  private readonly builtInPlugins?: BuiltInPluginDefinition[];
  private cardService?: CardService;
  private cardInfoService?: CardInfoService;
  private cardSessionService?: CardSessionService;
  private boxService?: BoxService;
  private boxSessionService?: BoxSessionService;
  private workspaceService?: WorkspaceService;
  private zipService?: StoreZipService;
  private startupLaunchPluginId?: string;
  private started = false;

  public constructor(options: HostCoreOptions) {
    this.kernel = new Kernel();
    this.pal = options.pal;
    this.logger = new StructuredLogger();
    this.workspacePath = options.workspacePath ?? path.join(os.homedir(), '.chips-host');
    this.builtInPluginRoots = options.builtInPluginRoots ?? resolveDefaultBuiltInPluginRoots();
    this.builtInPlugins = options.builtInPlugins;
    this.runtime = new PluginRuntime(this.workspacePath, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
  }

  public async start(): Promise<void> {
    if (this.started) {
      return;
    }

    registerHostSchemas();
    await this.loadPersistentLogs();
    await this.runtime.load();
    const builtInBootstrap = await ensureBuiltInPlugins({
      runtime: this.runtime,
      pluginRoots: this.builtInPluginRoots,
      plugins: this.builtInPlugins
    });
    this.startupLaunchPluginId = builtInBootstrap.launchPluginId;

    await registerHostServices({
      kernel: this.kernel,
      pal: this.pal,
      workspacePath: this.workspacePath,
      logger: this.logger,
      getCardService: () => this.getCardService(),
      getCardInfoService: () => this.getCardInfoService(),
      getCardSessionService: () => this.getCardSessionService(),
      getBoxService: () => this.getBoxService(),
      getBoxSessionService: () => this.getBoxSessionService(),
      getWorkspaceService: () => this.getWorkspaceService(),
      getZipService: () => {
        this.zipService ??= new StoreZipService();
        return this.zipService;
      },
      runtime: this.runtime
    });

    if (builtInBootstrap.shortcutPluginIds.length > 0) {
      try {
        await ensureBuiltInPluginShortcuts(new RuntimeClient(this.createBridge()), builtInBootstrap.shortcutPluginIds);
      } catch (error) {
        this.logger.write({
          level: 'warn',
          message: 'Failed to materialize built-in plugin shortcuts',
          requestId: 'built-in-shortcut-bootstrap',
          namespace: 'host',
          action: 'bootstrap.shortcuts',
          result: 'error',
          metadata: {
            pluginIds: builtInBootstrap.shortcutPluginIds,
            error
          }
        });
      }
    }

    await fs.writeFile(
      path.join(this.workspacePath, 'route-manifest.json'),
      JSON.stringify(this.kernel.getRouteManifest(), null, 2),
      'utf-8'
    );
    await fs.writeFile(
      path.join(this.workspacePath, 'route-descriptor-manifest.json'),
      JSON.stringify({ routes: this.kernel.getRouteDescriptorManifest() }, null, 2),
      'utf-8'
    );

    this.started = true;
    this.logger.write({
      level: 'info',
      message: 'Chips Host core started',
      requestId: 'system-start',
      namespace: 'host-core',
      action: 'start',
      result: 'success'
    });
  }

  public async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.logger.write({
      level: 'info',
      message: 'Chips Host core stopped',
      requestId: 'system-stop',
      namespace: 'host-core',
      action: 'stop',
      result: 'success'
    });
    await this.persistLogs();
  }

  public isRunning(): boolean {
    return this.started;
  }

  public takeStartupLaunchPluginId(): string | undefined {
    const nextPluginId = this.startupLaunchPluginId;
    this.startupLaunchPluginId = undefined;
    return nextPluginId;
  }

  public createBridge() {
    return createBridgeForKernel(this.kernel, {
      callerId: 'host-core',
      callerType: 'app',
      permissions: [...HOST_INTERNAL_PERMISSIONS]
    });
  }

  public resolveManagedDocumentFilePath(requestUrl: string): string | null {
    return (
      this.getCardService().resolveManagedDocumentFilePath(requestUrl)
      ?? this.getBoxService().resolveManagedDocumentFilePath(requestUrl)
      ?? null
    );
  }

  private resolveManagedDocumentScheme(): string | undefined {
    const electron = loadElectronModule();
    return electron?.protocol && typeof electron.protocol.handle === 'function' && electron?.net?.fetch
      ? CHIPS_RENDER_DOCUMENT_SCHEME
      : undefined;
  }

  private logFilePath(): string {
    return path.join(this.workspacePath, 'host-logs.jsonl');
  }

  private async readPersistentLogEntries(): Promise<LogEntry[]> {
    const filePath = this.logFilePath();
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const entries: LogEntry[] = [];
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          const entry = JSON.parse(trimmed) as LogEntry;
          if (entry && typeof entry.requestId === 'string' && typeof entry.message === 'string') {
            entries.push(entry);
          }
        } catch {
          // Ignore damaged lines and keep the rest of the operation log readable.
        }
      }
      return entries;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      void code;
      return [];
    }
  }

  private async loadPersistentLogs(): Promise<void> {
    this.logger.load(await this.readPersistentLogEntries());
  }

  private async persistLogs(): Promise<void> {
    const merged = new Map<string, LogEntry>();
    for (const entry of await this.readPersistentLogEntries()) {
      merged.set(`${entry.traceId}:${entry.requestId}:${entry.timestamp}:${entry.action ?? ''}:${entry.message}`, entry);
    }
    for (const entry of this.logger.query()) {
      merged.set(`${entry.traceId}:${entry.requestId}:${entry.timestamp}:${entry.action ?? ''}:${entry.message}`, entry);
    }
    const payload = `${[...merged.values()].map((entry) => JSON.stringify(entry)).join('\n')}\n`;
    await fs.mkdir(this.workspacePath, { recursive: true });
    await fs.writeFile(this.logFilePath(), payload, 'utf-8');
  }

  private getCardService(): CardService {
    if (!this.cardService) {
      this.cardService = new CardService({
        runtime: this.runtime,
        workspaceRoot: process.cwd(),
        managedDocumentScheme: this.resolveManagedDocumentScheme(),
      });
    }

    return this.cardService;
  }

  private getCardInfoService(): CardInfoService {
    if (!this.cardInfoService) {
      this.cardInfoService = new CardInfoService({
        validate: (cardFile) => this.getCardService().validate(cardFile),
        readMetadata: (cardFile) => this.getCardService().readMetadata(cardFile),
        renderCover: (cardFile) => this.getCardService().renderCover(cardFile)
      });
    }

    return this.cardInfoService;
  }

  private getCardSessionService(): CardSessionService {
    if (!this.cardSessionService) {
      const cardService = this.getCardService();
      this.cardSessionService = new CardSessionService(
        {
          basecard: createBasecardAdapter(cardService),
          collectCoverReferences: (html) => collectCoverResourceReferences(html),
          createDefaultCoverHtml
        },
        {
          emit: (event, payload) => {
            void this.kernel.events.emit(event, 'card-session-service', payload).catch(() => undefined);
          }
        }
      );
    }

    return this.cardSessionService;
  }

  private getBoxService(): BoxService {
    if (!this.boxService) {
      this.boxService = new BoxService(undefined, {
        runtime: this.runtime,
        workspaceRoot: process.cwd(),
        managedDocumentScheme: this.resolveManagedDocumentScheme(),
      });
    }

    return this.boxService;
  }

  private getBoxSessionService(): BoxSessionService {
    if (!this.boxSessionService) {
      const boxService = this.getBoxService();
      this.boxSessionService = new BoxSessionService(
        {
          pack: async (boxDir, outputPath) => {
            await boxService.pack(boxDir, outputPath);
          },
          unpack: async (boxFile, outputDir) => {
            await boxService.unpack(boxFile, outputDir);
          },
          inspect: (boxFile) => boxService.inspect(boxFile),
          layout: {
            readDescriptor: (layoutType) => boxService.readLayoutDescriptor(layoutType),
            normalizeConfig: (layoutType, config) => boxService.normalizeLayoutConfig(layoutType, config),
          },
          documentInfo: {
            readCardInfo: async (cardFile) => {
              const result = await this.getCardInfoService().readInfo(cardFile, ['status', 'metadata']);
              return {
                name: result.info.metadata?.name,
                cardId: result.info.metadata?.cardId,
                tags: result.info.metadata?.tags,
                ready: result.info.status?.state === 'ready',
              };
            },
            readBoxMetadata: async (boxFile) => {
              const metadata = await boxService.readMetadata(boxFile);
              return { boxId: metadata.boxId, name: metadata.name, tags: metadata.tags };
            },
          },
          createDefaultCoverHtml,
        },
        {
          emit: (event, payload) => {
            void this.kernel.events.emit(event, 'box-session-service', payload).catch(() => undefined);
          },
        }
      );
    }

    return this.boxSessionService;
  }

  private getWorkspaceService(): WorkspaceService {
    if (!this.workspaceService) {
      this.workspaceService = new WorkspaceService({
        readBoxMetadata: async (boxFile) => {
          try {
            const metadata = await this.getBoxService().readMetadata(boxFile);
            return {
              boxId: metadata.boxId,
              name: metadata.name,
              createdAt: metadata.createdAt,
              modifiedAt: metadata.modifiedAt,
            };
          } catch {
            return null;
          }
        },
      });
    }
    return this.workspaceService;
  }
}
