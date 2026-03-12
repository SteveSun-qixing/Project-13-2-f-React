import { objectWithKeys, schemaRegistry, type SchemaValidator } from '../../shared/schema';

const registerPair = (action: string, requestKeys: string[], responseKeys: string[] = []): void => {
  schemaRegistry.register(`schemas/${action}.request.json`, objectWithKeys(requestKeys));
  schemaRegistry.register(`schemas/${action}.response.json`, objectWithKeys(responseKeys));
};

const RENDER_TARGETS = new Set(['app-root', 'card-iframe', 'module-slot', 'offscreen-render']);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const validateCardRenderRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  if (typeof input.cardFile !== 'string' || input.cardFile.trim().length === 0) {
    errors.push('cardFile must be a non-empty string');
  }

  if (typeof input.options !== 'undefined') {
    if (!isRecord(input.options)) {
      errors.push('options must be an object');
    } else {
      const target = input.options.target;
      if (typeof target !== 'undefined' && (typeof target !== 'string' || !RENDER_TARGETS.has(target))) {
        errors.push('options.target is invalid');
      }

      const verifyConsistency = input.options.verifyConsistency;
      if (typeof verifyConsistency !== 'undefined' && typeof verifyConsistency !== 'boolean') {
        errors.push('options.verifyConsistency must be a boolean');
      }

      const viewport = input.options.viewport;
      if (typeof viewport !== 'undefined') {
        if (!isRecord(viewport)) {
          errors.push('options.viewport must be an object');
        } else {
          for (const key of ['width', 'height', 'scrollTop', 'scrollLeft']) {
            const value = viewport[key];
            if (typeof value === 'undefined') {
              continue;
            }
            if (typeof value !== 'number' || !Number.isFinite(value)) {
              errors.push(`options.viewport.${key} must be a finite number`);
              continue;
            }
            if ((key === 'width' || key === 'height') && value <= 0) {
              errors.push(`options.viewport.${key} must be greater than 0`);
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }
  return { valid: true };
};

const validateBaseCardNodeRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  if (typeof input.cardFile !== 'string' || input.cardFile.trim().length === 0) {
    errors.push('cardFile must be a non-empty string');
  }
  if (typeof input.nodeId !== 'string' || input.nodeId.trim().length === 0) {
    errors.push('nodeId must be a non-empty string');
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateBaseCardUpdateRequest: SchemaValidator = (input: unknown) => {
  const base = validateBaseCardNodeRequest(input);
  if (!base.valid) {
    return base;
  }

  const record = input as Record<string, unknown>;
  if (!isRecord(record.config)) {
    return {
      valid: false,
      errors: ['config must be an object']
    };
  }

  return { valid: true };
};

export const registerHostSchemas = (): void => {
  registerPair('file.read', ['path']);
  registerPair('file.write', ['path', 'content']);
  registerPair('file.stat', ['path']);
  registerPair('file.list', ['dir']);
  registerPair('file.watch', ['path']);
  registerPair('file.exists', ['path']);
  registerPair('file.mkdir', ['path']);
  registerPair('file.delete', ['path']);
  registerPair('file.copy', ['source', 'destination']);
  registerPair('file.move', ['source', 'destination']);

  registerPair('resource.resolve', ['resourceId']);
  registerPair('resource.readMetadata', ['resourceId']);
  registerPair('resource.readBinary', ['resourceId']);

  registerPair('config.get', ['key']);
  registerPair('config.set', ['key', 'value']);
  registerPair('config.batchSet', ['entries']);
  registerPair('config.reset', []);

  registerPair('theme.list', []);
  registerPair('theme.apply', ['id']);
  registerPair('theme.getCurrent', []);
  registerPair('theme.getAllCss', []);
  registerPair('theme.resolve', ['chain']);
  registerPair('theme.contract.get', []);

  registerPair('i18n.getCurrent', []);
  registerPair('i18n.setCurrent', ['locale']);
  registerPair('i18n.translate', ['key']);
  registerPair('i18n.listLocales', []);

  registerPair('window.open', ['config']);
  registerPair('window.focus', ['windowId']);
  registerPair('window.resize', ['windowId', 'width', 'height']);
  registerPair('window.setState', ['windowId', 'state']);
  registerPair('window.getState', ['windowId']);
  registerPair('window.close', ['windowId']);

  registerPair('platform.dialogOpenFile', []);
  registerPair('platform.dialogSaveFile', []);
  registerPair('platform.dialogShowMessage', ['options']);
  registerPair('platform.dialogShowConfirm', ['options']);
  registerPair('platform.clipboardRead', []);
  registerPair('platform.clipboardWrite', ['data']);
  registerPair('platform.shellOpenPath', ['path']);
  registerPair('platform.shellOpenExternal', ['url']);
  registerPair('platform.shellShowItemInFolder', ['path']);
  registerPair('platform.notificationShow', ['options']);
  registerPair('platform.traySet', ['options']);
  registerPair('platform.trayClear', []);
  registerPair('platform.trayGetState', []);
  registerPair('platform.shortcutRegister', ['accelerator']);
  registerPair('platform.shortcutUnregister', ['accelerator']);
  registerPair('platform.shortcutIsRegistered', ['accelerator']);
  registerPair('platform.shortcutList', []);
  registerPair('platform.shortcutClear', []);
  registerPair('platform.powerGetState', []);
  registerPair('platform.powerSetPreventSleep', ['prevent']);
  registerPair('platform.ipcCreateChannel', ['name', 'transport']);
  registerPair('platform.ipcSend', ['channelId', 'payload']);
  registerPair('platform.ipcReceive', ['channelId']);
  registerPair('platform.ipcCloseChannel', ['channelId']);
  registerPair('platform.ipcListChannels', []);

  registerPair('plugin.list', []);
  registerPair('plugin.get', ['pluginId']);
  registerPair('plugin.getSelf', []);
  registerPair('plugin.getCardPlugin', ['cardType']);
  registerPair('plugin.getLayoutPlugin', ['layoutType']);
  registerPair('plugin.install', ['manifestPath']);
  registerPair('plugin.enable', ['pluginId']);
  registerPair('plugin.disable', ['pluginId']);
  registerPair('plugin.uninstall', ['pluginId']);
  registerPair('plugin.launch', ['pluginId']);
  registerPair('plugin.getShortcut', ['pluginId']);
  registerPair('plugin.createShortcut', ['pluginId']);
  registerPair('plugin.removeShortcut', ['pluginId']);
  registerPair('plugin.query', []);
  registerPair('plugin.init', ['pluginId']);
  registerPair('plugin.handshake.complete', ['sessionId', 'nonce']);

  registerPair('module.mount', ['slot', 'module']);
  registerPair('module.unmount', ['slot']);
  registerPair('module.query', ['slot']);
  registerPair('module.list', []);

  registerPair('platform.getInfo', []);
  registerPair('platform.getCapabilities', []);
  registerPair('platform.getScreenInfo', []);
  registerPair('platform.listScreens', []);
  registerPair('platform.openExternal', ['url']);

  registerPair('log.write', ['level', 'message']);
  registerPair('log.query', []);
  registerPair('log.export', []);

  registerPair('credential.get', ['ref']);
  registerPair('credential.set', ['ref', 'value']);
  registerPair('credential.delete', ['ref']);
  registerPair('credential.rotate', ['ref']);

  registerPair('card.parse', ['cardFile']);
  schemaRegistry.register('schemas/card.getBaseCard.request.json', validateBaseCardNodeRequest);
  schemaRegistry.register('schemas/card.getBaseCard.response.json', objectWithKeys(['baseCard']));
  schemaRegistry.register('schemas/card.render.request.json', validateCardRenderRequest);
  schemaRegistry.register('schemas/card.render.response.json', objectWithKeys(['view']));
  schemaRegistry.register('schemas/card.renderBaseCardEditor.request.json', validateBaseCardNodeRequest);
  schemaRegistry.register('schemas/card.renderBaseCardEditor.response.json', objectWithKeys(['editor']));
  registerPair('card.validate', ['cardFile']);
  schemaRegistry.register('schemas/card.updateBaseCard.request.json', validateBaseCardUpdateRequest);
  schemaRegistry.register('schemas/card.updateBaseCard.response.json', objectWithKeys(['baseCard']));

  registerPair('box.pack', ['boxDir', 'outputPath']);
  registerPair('box.unpack', ['boxFile', 'outputDir']);
  registerPair('box.inspect', ['boxFile']);

  registerPair('zip.compress', ['inputDir', 'outputZip']);
  registerPair('zip.extract', ['zipPath', 'outputDir']);
  registerPair('zip.list', ['zipPath']);

  registerPair('serializer.encode', ['payload']);
  registerPair('serializer.decode', ['payload']);
  registerPair('serializer.validate', ['payload', 'schema']);

  registerPair('control-plane.health', []);
  registerPair('control-plane.check', []);
  registerPair('control-plane.metrics', []);
  registerPair('control-plane.diagnose', []);
};
