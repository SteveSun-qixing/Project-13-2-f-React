import { pathToFileURL } from 'node:url';
import type { ElectronModuleLike } from './electron-loader';
import { loadElectronModule } from './electron-loader';

export const CHIPS_RENDER_DOCUMENT_SCHEME = 'chips-render';

type ResolveDocumentPath = (requestUrl: string) => Promise<string | null> | string | null;

const privilegedSchemeRegistrations = new WeakSet<object>();
const activeResolvers = new WeakMap<object, ResolveDocumentPath>();
const handledProtocols = new WeakSet<object>();

export const registerChipsRenderDocumentScheme = (
  electron: ElectronModuleLike | null = loadElectronModule(),
): void => {
  const protocol = electron?.protocol;
  if (!protocol || typeof protocol.registerSchemesAsPrivileged !== 'function') {
    return;
  }

  const protocolRef = protocol as object;
  if (privilegedSchemeRegistrations.has(protocolRef)) {
    return;
  }

  protocol.registerSchemesAsPrivileged([
    {
      scheme: CHIPS_RENDER_DOCUMENT_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
      },
    },
  ]);
  privilegedSchemeRegistrations.add(protocolRef);
};

export const registerChipsRenderDocumentProtocol = (
  resolveDocumentPath: ResolveDocumentPath,
  electron: ElectronModuleLike | null = loadElectronModule(),
): (() => void) => {
  const protocol = electron?.protocol;
  const net = electron?.net;
  if (!protocol || typeof protocol.handle !== 'function' || !net || typeof net.fetch !== 'function') {
    return () => undefined;
  }

  const protocolRef = protocol as object;
  activeResolvers.set(protocolRef, resolveDocumentPath);

  if (!handledProtocols.has(protocolRef)) {
    protocol.handle(CHIPS_RENDER_DOCUMENT_SCHEME, async (request) => {
      const resolver = activeResolvers.get(protocolRef);
      const filePath = resolver ? await resolver(request.url) : null;
      if (!filePath) {
        return new Response('Not Found', {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
          },
        });
      }
      return net.fetch(pathToFileURL(filePath).href);
    });
    handledProtocols.add(protocolRef);
  }

  return () => {
    activeResolvers.delete(protocolRef);
  };
};
