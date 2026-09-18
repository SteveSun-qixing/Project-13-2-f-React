import { objectWithKeys, schemaRegistry, type SchemaValidator } from '../../shared/schema';

const registerPair = (action: string, requestKeys: string[], responseKeys: string[] = []): void => {
  schemaRegistry.register(`schemas/${action}.request.json`, objectWithKeys(requestKeys));
  schemaRegistry.register(`schemas/${action}.response.json`, objectWithKeys(responseKeys));
};

const RENDER_TARGETS = new Set(['app-root', 'card-iframe', 'module-slot', 'offscreen-render']);
const CARD_RENDER_MODES = new Set(['view', 'preview']);
const CARD_INTERACTION_POLICIES = new Set(['native', 'delegate']);
const MODULE_PROVIDER_STATUSES = new Set(['enabled', 'running', 'disabled', 'error']);

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

      validateOptionalString(input.options.themeId, 'options.themeId', errors);
      validateOptionalString(input.options.locale, 'options.locale', errors);

      const mode = input.options.mode;
      if (typeof mode !== 'undefined' && (typeof mode !== 'string' || !CARD_RENDER_MODES.has(mode))) {
        errors.push('options.mode is invalid');
      }

      const interactionPolicy = input.options.interactionPolicy;
      if (
        typeof interactionPolicy !== 'undefined' &&
        (typeof interactionPolicy !== 'string' || !CARD_INTERACTION_POLICIES.has(interactionPolicy))
      ) {
        errors.push('options.interactionPolicy is invalid');
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

const validateCardRenderEditorRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  if (typeof input.cardType !== 'string' || input.cardType.trim().length === 0) {
    errors.push('cardType must be a non-empty string');
  }

  if (typeof input.baseCardId !== 'undefined' && (typeof input.baseCardId !== 'string' || input.baseCardId.trim().length === 0)) {
    errors.push('baseCardId must be a non-empty string when provided');
  }

  if (typeof input.initialConfig !== 'undefined' && !isRecord(input.initialConfig)) {
    errors.push('initialConfig must be an object when provided');
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateResourceOpenRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  validateOptionalString(input.intent, 'intent', errors);

  if (!isRecord(input.resource)) {
    errors.push('resource must be an object');
  } else {
    if (typeof input.resource.resourceId !== 'string' || input.resource.resourceId.trim().length === 0) {
      errors.push('resource.resourceId must be a non-empty string');
    }
    validateOptionalString(input.resource.mimeType, 'resource.mimeType', errors);
    validateOptionalString(input.resource.title, 'resource.title', errors);
    validateOptionalString(input.resource.fileName, 'resource.fileName', errors);
    if (typeof input.resource.payload !== 'undefined' && !isRecord(input.resource.payload)) {
      errors.push('resource.payload must be an object when provided');
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateResourceConvertTiffToPngRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  if (typeof input.resourceId !== 'string' || input.resourceId.trim().length === 0) {
    errors.push('resourceId must be a non-empty string');
  }
  if (typeof input.outputFile !== 'string' || input.outputFile.trim().length === 0) {
    errors.push('outputFile must be a non-empty string');
  }
  if (typeof input.overwrite !== 'undefined' && typeof input.overwrite !== 'boolean') {
    errors.push('overwrite must be a boolean when provided');
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateResourceExtractVideoFrameRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  if (typeof input.resourceId !== 'string' || input.resourceId.trim().length === 0) {
    errors.push('resourceId must be a non-empty string');
  }
  if (typeof input.outputFile !== 'string' || input.outputFile.trim().length === 0) {
    errors.push('outputFile must be a non-empty string');
  }
  if (typeof input.overwrite !== 'undefined' && typeof input.overwrite !== 'boolean') {
    errors.push('overwrite must be a boolean when provided');
  }
  if (typeof input.options !== 'undefined') {
    if (!isRecord(input.options)) {
      errors.push('options must be an object');
    } else {
      validateOptionalFiniteNumber(input.options.timeSeconds, 'options.timeSeconds', errors);
      if (typeof input.options.timeSeconds === 'number' && input.options.timeSeconds < 0) {
        errors.push('options.timeSeconds must be greater than or equal to 0 when provided');
      }
      validateOptionalString(input.options.format, 'options.format', errors);
      if (
        typeof input.options.format !== 'undefined' &&
        input.options.format !== 'png' &&
        input.options.format !== 'jpeg'
      ) {
        errors.push('options.format must be png or jpeg when provided');
      }
      validateOptionalFiniteNumber(input.options.width, 'options.width', errors);
      validateOptionalFiniteNumber(input.options.height, 'options.height', errors);
      if (typeof input.options.width === 'number' && input.options.width <= 0) {
        errors.push('options.width must be greater than 0 when provided');
      }
      if (typeof input.options.height === 'number' && input.options.height <= 0) {
        errors.push('options.height must be greater than 0 when provided');
      }
      validateOptionalString(input.options.fit, 'options.fit', errors);
      if (
        typeof input.options.fit !== 'undefined' &&
        input.options.fit !== 'contain' &&
        input.options.fit !== 'cover'
      ) {
        errors.push('options.fit must be contain or cover when provided');
      }
      validateOptionalFiniteNumber(input.options.quality, 'options.quality', errors);
      if (typeof input.options.quality === 'number' && (input.options.quality < 1 || input.options.quality > 100)) {
        errors.push('options.quality must be between 1 and 100 when provided');
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateOptionalString = (value: unknown, field: string, errors: string[]): void => {
  if (typeof value !== 'undefined' && (typeof value !== 'string' || value.trim().length === 0)) {
    errors.push(`${field} must be a non-empty string when provided`);
  }
};

const validateOptionalFiniteNumber = (value: unknown, field: string, errors: string[]): void => {
  if (typeof value !== 'undefined' && (typeof value !== 'number' || !Number.isFinite(value))) {
    errors.push(`${field} must be a finite number when provided`);
  }
};

const COMMAND_SCOPE_KINDS = new Set(['global', 'app', 'scene', 'surface', 'document']);
const COMMAND_SOURCES = new Set(['menu', 'toolbar', 'shortcut', 'palette', 'context-menu', 'api', 'cli']);
const COMMAND_ICON_STYLES = new Set(['outlined', 'rounded', 'sharp']);

const validateOptionalStringArray = (value: unknown, field: string, errors: string[]): void => {
  if (typeof value === 'undefined' || typeof value === 'string') {
    validateOptionalString(value, field, errors);
    return;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    errors.push(`${field} must be a non-empty string or string[]`);
  }
};

const validateCommandCondition = (value: unknown, field: string, errors: string[]): void => {
  if (typeof value === 'undefined' || typeof value === 'boolean') {
    return;
  }
  if (!isRecord(value)) {
    errors.push(`${field} must be a boolean or object`);
    return;
  }
  if (typeof value.key !== 'string' || value.key.trim().length === 0) {
    errors.push(`${field}.key must be a non-empty string`);
  }
  if (typeof value.in !== 'undefined' && !Array.isArray(value.in)) {
    errors.push(`${field}.in must be an array when provided`);
  }
  if (typeof value.truthy !== 'undefined' && typeof value.truthy !== 'boolean') {
    errors.push(`${field}.truthy must be a boolean when provided`);
  }
};

const validateCommandIcon = (value: unknown, errors: string[]): void => {
  if (typeof value === 'undefined') {
    return;
  }
  if (!isRecord(value)) {
    errors.push('icon must be an object');
    return;
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    errors.push('icon.name must be a non-empty string');
  }
  if (typeof value.style !== 'undefined' && (typeof value.style !== 'string' || !COMMAND_ICON_STYLES.has(value.style))) {
    errors.push('icon.style is invalid');
  }
  if (typeof value.fill !== 'undefined' && value.fill !== 0 && value.fill !== 1) {
    errors.push('icon.fill must be 0 or 1 when provided');
  }
  for (const key of ['wght', 'grad', 'opsz']) {
    if (typeof value[key] !== 'undefined' && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) {
      errors.push(`icon.${key} must be a finite number when provided`);
    }
  }
};

const validateCommandScope = (value: unknown, errors: string[]): void => {
  if (typeof value === 'undefined') {
    return;
  }
  if (!isRecord(value)) {
    errors.push('scope must be an object');
    return;
  }
  if (typeof value.kind !== 'string' || !COMMAND_SCOPE_KINDS.has(value.kind)) {
    errors.push('scope.kind is invalid');
  }
  validateOptionalString(value.appId, 'scope.appId', errors);
  validateOptionalString(value.sceneId, 'scope.sceneId', errors);
  validateOptionalString(value.surfaceId, 'scope.surfaceId', errors);
  validateOptionalString(value.documentId, 'scope.documentId', errors);
};

const validateCommandShortcut = (value: unknown, errors: string[]): void => {
  if (typeof value === 'undefined') {
    return;
  }
  const items = Array.isArray(value) ? value : [value];
  for (const [index, item] of items.entries()) {
    if (!isRecord(item)) {
      errors.push(`shortcut.${index} must be an object`);
      continue;
    }
    if (typeof item.accelerator !== 'string' || item.accelerator.trim().length === 0) {
      errors.push(`shortcut.${index}.accelerator must be a non-empty string`);
    }
    if (
      typeof item.platform !== 'undefined' &&
      (typeof item.platform !== 'string' || !['all', 'desktop', 'web', 'mobile', 'headless'].includes(item.platform))
    ) {
      errors.push(`shortcut.${index}.platform is invalid`);
    }
    validateCommandCondition(item.when, `shortcut.${index}.when`, errors);
  }
};

const validateCommandPlacement = (
  value: unknown,
  field: 'menuPlacement' | 'toolbarPlacement',
  idField: 'menuId' | 'toolbarId',
  errors: string[]
): void => {
  if (typeof value === 'undefined') {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return;
  }
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      errors.push(`${field}.${index} must be an object`);
      continue;
    }
    if (typeof item[idField] !== 'string' || item[idField].trim().length === 0) {
      errors.push(`${field}.${index}.${idField} must be a non-empty string`);
    }
    validateOptionalString(item.groupId, `${field}.${index}.groupId`, errors);
    validateOptionalFiniteNumber(item.order, `${field}.${index}.order`, errors);
  }
};

const validateCommandState = (value: unknown, errors: string[]): void => {
  if (typeof value === 'undefined') {
    return;
  }
  if (!isRecord(value)) {
    errors.push('state must be an object');
    return;
  }
  for (const key of ['enabled', 'visible', 'checked']) {
    if (typeof value[key] !== 'undefined' && typeof value[key] !== 'boolean') {
      errors.push(`state.${key} must be a boolean when provided`);
    }
  }
  validateOptionalString(value.disabledReasonKey, 'state.disabledReasonKey', errors);
  validateOptionalString(value.hiddenReasonKey, 'state.hiddenReasonKey', errors);
  validateOptionalString(value.reasonKey, 'state.reasonKey', errors);
};

const validateCommandRegisterRequest: SchemaValidator = (input: unknown) => {
  const command = isRecord(input) && isRecord(input.command) ? input.command : input;
  if (!isRecord(command)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  for (const rawField of ['title', 'description', 'ariaLabel', 'label']) {
    if (typeof command[rawField] !== 'undefined') {
      errors.push(`${rawField} is not allowed; use i18n key fields`);
    }
  }
  if (typeof command.commandId !== 'string' || command.commandId.trim().length === 0) {
    errors.push('commandId must be a non-empty string');
  }
  if (typeof command.titleKey !== 'string' || command.titleKey.trim().length === 0) {
    errors.push('titleKey must be a non-empty string');
  }
  validateOptionalString(command.descriptionKey, 'descriptionKey', errors);
  validateOptionalString(command.ariaLabelKey, 'ariaLabelKey', errors);
  if (typeof command.handlerId !== 'string' || command.handlerId.trim().length === 0) {
    errors.push('handlerId must be a non-empty string');
  }
  validateCommandIcon(command.icon, errors);
  validateCommandShortcut(command.shortcut, errors);
  validateCommandScope(command.scope, errors);
  validateOptionalStringArray(command.permission, 'permission', errors);
  validateCommandCondition(command.enabledWhen, 'enabledWhen', errors);
  validateCommandCondition(command.visibleWhen, 'visibleWhen', errors);
  validateCommandCondition(command.checkedWhen, 'checkedWhen', errors);
  validateCommandPlacement(command.menuPlacement, 'menuPlacement', 'menuId', errors);
  validateCommandPlacement(command.toolbarPlacement, 'toolbarPlacement', 'toolbarId', errors);
  validateOptionalStringArray(command.paletteKeywords, 'paletteKeywords', errors);
  validateCommandState(command.state, errors);
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateCommandIdRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  if (typeof input.commandId !== 'string' || input.commandId.trim().length === 0) {
    return { valid: false, errors: ['commandId must be a non-empty string'] };
  }
  return { valid: true };
};

const validateCommandListRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  validateOptionalString(input.commandId, 'commandId', errors);
  validateOptionalString(input.ownerPluginId, 'ownerPluginId', errors);
  validateCommandScope(input.scope, errors);
  if (typeof input.source !== 'undefined' && (typeof input.source !== 'string' || !COMMAND_SOURCES.has(input.source))) {
    errors.push('source is invalid');
  }
  if (typeof input.includeDisabled !== 'undefined' && typeof input.includeDisabled !== 'boolean') {
    errors.push('includeDisabled must be a boolean when provided');
  }
  if (typeof input.includeHidden !== 'undefined' && typeof input.includeHidden !== 'boolean') {
    errors.push('includeHidden must be a boolean when provided');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateCommandSetStateRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  if (typeof input.commandId !== 'string' || input.commandId.trim().length === 0) {
    errors.push('commandId must be a non-empty string');
  }
  validateCommandState(input.state, errors);
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateCommandInvokeRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  if (typeof input.commandId !== 'string' || input.commandId.trim().length === 0) {
    errors.push('commandId must be a non-empty string');
  }
  if (typeof input.source !== 'undefined' && (typeof input.source !== 'string' || !COMMAND_SOURCES.has(input.source))) {
    errors.push('source is invalid');
  }
  if (typeof input.payload !== 'undefined' && !isRecord(input.payload)) {
    errors.push('payload must be an object when provided');
  }
  if (typeof input.context !== 'undefined' && !isRecord(input.context)) {
    errors.push('context must be an object when provided');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateCliCommandQueryRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  validateOptionalString(input.commandId, 'commandId', errors);
  validateOptionalString(input.pluginId, 'pluginId', errors);
  if (typeof input.commandPath !== 'undefined') {
    if (typeof input.commandPath === 'string') {
      if (input.commandPath.trim().length === 0) {
        errors.push('commandPath must be a non-empty string when provided');
      }
    } else if (
      !Array.isArray(input.commandPath) ||
      input.commandPath.some((segment) => typeof segment !== 'string' || segment.trim().length === 0)
    ) {
      errors.push('commandPath must be a non-empty string or string[] when provided');
    }
  }
  if (
    typeof input.targetType !== 'undefined' &&
    input.targetType !== 'app' &&
    input.targetType !== 'module'
  ) {
    errors.push('targetType must be app or module when provided');
  }
  if (typeof input.includeDisabled !== 'undefined' && typeof input.includeDisabled !== 'boolean') {
    errors.push('includeDisabled must be a boolean when provided');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateModuleListProvidersRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  validateOptionalString(input.capability, 'capability', errors);
  validateOptionalString(input.pluginId, 'pluginId', errors);
  validateOptionalString(input.versionRange, 'versionRange', errors);
  if (
    typeof input.status !== 'undefined' &&
    (typeof input.status !== 'string' || !MODULE_PROVIDER_STATUSES.has(input.status))
  ) {
    errors.push('status must be one of enabled/running/disabled/error');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateModuleResolveRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  if (typeof input.capability !== 'string' || input.capability.trim().length === 0) {
    errors.push('capability must be a non-empty string');
  }
  validateOptionalString(input.versionRange, 'versionRange', errors);
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateModuleInvokeRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  if (typeof input.capability !== 'string' || input.capability.trim().length === 0) {
    errors.push('capability must be a non-empty string');
  }
  if (typeof input.method !== 'string' || input.method.trim().length === 0) {
    errors.push('method must be a non-empty string');
  }
  if (!isRecord(input.input)) {
    errors.push('input must be an object');
  }
  validateOptionalString(input.pluginId, 'pluginId', errors);
  if (
    typeof input.timeoutMs !== 'undefined' &&
    (typeof input.timeoutMs !== 'number' || !Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0)
  ) {
    errors.push('timeoutMs must be a positive finite number when provided');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateModuleInvokeResponse: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  if (input.mode === 'sync') {
    return 'output' in input ? { valid: true } : { valid: false, errors: ['sync response must include output'] };
  }

  if (input.mode === 'job') {
    return typeof input.jobId === 'string' && input.jobId.trim().length > 0
      ? { valid: true }
      : { valid: false, errors: ['job response must include non-empty jobId'] };
  }

  return { valid: false, errors: ['mode must be sync or job'] };
};

const validateModuleJobRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  return typeof input.jobId === 'string' && input.jobId.trim().length > 0
    ? { valid: true }
    : { valid: false, errors: ['jobId must be a non-empty string'] };
};

const validateCliTaskCreateRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  if (typeof input.pluginId !== 'string' || input.pluginId.trim().length === 0) {
    errors.push('pluginId must be a non-empty string');
  }
  if (typeof input.commandId !== 'string' || input.commandId.trim().length === 0) {
    errors.push('commandId must be a non-empty string');
  }
  if (
    typeof input.commandPath !== 'undefined' &&
    (!Array.isArray(input.commandPath) || input.commandPath.some((item) => typeof item !== 'string' || item.trim().length === 0))
  ) {
    errors.push('commandPath must be a non-empty string[] when provided');
  }
  validateOptionalString(input.surfaceId, 'surfaceId', errors);
  validateOptionalString(input.sessionId, 'sessionId', errors);
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateCliTaskBindRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  validateRequiredCliTaskId(input.taskId, errors);
  validateOptionalString(input.invocationId, 'invocationId', errors);
  validateOptionalString(input.surfaceId, 'surfaceId', errors);
  validateOptionalString(input.sessionId, 'sessionId', errors);
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateCliTaskRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  validateRequiredCliTaskId(input.taskId, errors);
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateCliTaskProgressRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  validateRequiredCliTaskId(input.taskId, errors);
  if (!isRecord(input.progress)) {
    errors.push('progress must be an object');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateCliTaskCompleteRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  validateRequiredCliTaskId(input.taskId, errors);
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateCliTaskFailRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors: string[] = [];
  validateRequiredCliTaskId(input.taskId, errors);
  if (typeof input.error === 'undefined') {
    errors.push('error is required');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateRequiredCliTaskId = (value: unknown, errors: string[]): void => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push('taskId must be a non-empty string');
  }
};

const validatePlatformRenderHtmlToPdfRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  if (typeof input.htmlDir !== 'string' || input.htmlDir.trim().length === 0) {
    errors.push('htmlDir must be a non-empty string');
  }
  if (typeof input.outputFile !== 'string' || input.outputFile.trim().length === 0) {
    errors.push('outputFile must be a non-empty string');
  }
  validateOptionalString(input.entryFile, 'entryFile', errors);

  if (typeof input.options !== 'undefined') {
    if (!isRecord(input.options)) {
      errors.push('options must be an object');
    } else {
      validateOptionalString(input.options.pageSize, 'options.pageSize', errors);
      if (typeof input.options.landscape !== 'undefined' && typeof input.options.landscape !== 'boolean') {
        errors.push('options.landscape must be a boolean when provided');
      }
      if (typeof input.options.printBackground !== 'undefined' && typeof input.options.printBackground !== 'boolean') {
        errors.push('options.printBackground must be a boolean when provided');
      }
      if (typeof input.options.preferCSSPageSize !== 'undefined' && typeof input.options.preferCSSPageSize !== 'boolean') {
        errors.push('options.preferCSSPageSize must be a boolean when provided');
      }

      if (typeof input.options.marginMm !== 'undefined') {
        if (!isRecord(input.options.marginMm)) {
          errors.push('options.marginMm must be an object');
        } else {
          validateOptionalFiniteNumber(input.options.marginMm.top, 'options.marginMm.top', errors);
          validateOptionalFiniteNumber(input.options.marginMm.right, 'options.marginMm.right', errors);
          validateOptionalFiniteNumber(input.options.marginMm.bottom, 'options.marginMm.bottom', errors);
          validateOptionalFiniteNumber(input.options.marginMm.left, 'options.marginMm.left', errors);
        }
      }

      if (typeof input.options.headerFooter !== 'undefined') {
        if (!isRecord(input.options.headerFooter)) {
          errors.push('options.headerFooter must be an object');
        } else {
          if (typeof input.options.headerFooter.enabled !== 'undefined' && typeof input.options.headerFooter.enabled !== 'boolean') {
            errors.push('options.headerFooter.enabled must be a boolean when provided');
          }
          validateOptionalString(input.options.headerFooter.headerTemplate, 'options.headerFooter.headerTemplate', errors);
          validateOptionalString(input.options.headerFooter.footerTemplate, 'options.headerFooter.footerTemplate', errors);
        }
      }

      if (typeof input.options.wait !== 'undefined') {
        if (!isRecord(input.options.wait)) {
          errors.push('options.wait must be an object');
        } else {
          for (const key of ['timeoutMs', 'quietMs', 'resourceTimeoutMs', 'compositeTimeoutMs'] as const) {
            validateOptionalFiniteNumber(input.options.wait[key], `options.wait.${key}`, errors);
            if (typeof input.options.wait[key] === 'number' && input.options.wait[key] <= 0) {
              errors.push(`options.wait.${key} must be greater than 0 when provided`);
            }
          }
          for (const key of ['waitForFonts', 'waitForImages', 'waitForFrames', 'waitForCompositeReady'] as const) {
            if (typeof input.options.wait[key] !== 'undefined' && typeof input.options.wait[key] !== 'boolean') {
              errors.push(`options.wait.${key} must be a boolean when provided`);
            }
          }
        }
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validatePlatformRenderHtmlToImageRequest: SchemaValidator = (input: unknown) => {
  if (!isRecord(input)) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const errors: string[] = [];
  if (typeof input.htmlDir !== 'string' || input.htmlDir.trim().length === 0) {
    errors.push('htmlDir must be a non-empty string');
  }
  if (typeof input.outputFile !== 'string' || input.outputFile.trim().length === 0) {
    errors.push('outputFile must be a non-empty string');
  }
  validateOptionalString(input.entryFile, 'entryFile', errors);

  if (typeof input.options !== 'undefined') {
    if (!isRecord(input.options)) {
      errors.push('options must be an object');
    } else {
      validateOptionalString(input.options.format, 'options.format', errors);
      validateOptionalFiniteNumber(input.options.width, 'options.width', errors);
      validateOptionalFiniteNumber(input.options.height, 'options.height', errors);
      validateOptionalFiniteNumber(input.options.scaleFactor, 'options.scaleFactor', errors);
      validateOptionalString(input.options.background, 'options.background', errors);
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

export const registerHostSchemas = (): void => {
  registerPair('file.read', ['path']);
  registerPair('file.write', ['path', 'content']);
  registerPair('file.stat', ['path']);
  registerPair('file.list', ['dir']);
  registerPair('file.watch', ['path']);
  registerPair('file.mkdir', ['path']);
  registerPair('file.delete', ['path']);
  registerPair('file.move', ['sourcePath', 'destPath']);
  registerPair('file.copy', ['sourcePath', 'destPath']);
  registerPair('file.detectType', ['path']);
  registerPair('resource.importArchive', ['zipFile', 'targetRoot']);
  registerPair('workspace.getContext', [], ['rootPath']);
  registerPair('workspace.scan', ['rootPath'], ['files']);

  registerPair('office.document.create', ['format'], ['document']);
  registerPair('office.document.open', ['filePath'], ['document']);
  registerPair('office.document.read', ['sessionId'], ['document', 'bytes']);
  registerPair('office.document.write', ['sessionId', 'bytes'], ['document']);
  registerPair('office.document.get', ['sessionId'], ['document']);
  registerPair('office.document.persist', ['sessionId'], ['document']);
  registerPair('office.document.close', ['sessionId'], ['ack']);

  // file.session.* 万能文件会话（《15-万能文件处理协议》）；options 为可选对象，passthrough。
  // create 的 format/fileName 二选一由服务层校验，schema 不强制单键。
  registerPair('file.session.create', [], ['document']);
  registerPair('file.session.open', ['filePath'], ['document']);
  registerPair('file.session.read', ['sessionId'], ['document', 'bytes', 'offset', 'totalSize']);
  registerPair('file.session.write', ['sessionId', 'bytes'], ['document']);
  registerPair('file.session.get', ['sessionId'], ['document']);
  registerPair('file.session.persist', ['sessionId'], ['document']);
  registerPair('file.session.close', ['sessionId'], ['ack']);
  registerPair('file.session.watch', ['sessionId'], ['event']);

  // office.engine.* xlsx 引擎服务（sidecar 协议转发；大对象 passthrough 由插件侧校验）。
  registerPair('office.engine.open', ['path']);
  registerPair('office.engine.readRange', ['sessionId', 'sheetId', 'range']);
  registerPair('office.engine.readFormulaCells', ['sessionId', 'sheetId']);
  registerPair('office.engine.readMedia', ['sessionId', 'visualId'], ['mediaType', 'base64']);
  registerPair('office.engine.recalcCells', ['path']);
  registerPair('office.engine.cancel', ['sessionId', 'targetRequestId'], ['ack']);
  registerPair('office.engine.archiveManifest', ['path'], ['entries']);
  registerPair('office.engine.readEntries', ['path', 'entries'], ['entries']);
  registerPair('office.engine.scanEntries', ['path', 'entries', 'needle']);
  registerPair('office.engine.convertWorkbook', ['sourcePath'], ['targetPath']);
  registerPair('office.engine.saveArchive', ['sourcePath', 'targetPath', 'replacements', 'removals', 'additions']);  registerPair('office.engine.close', ['sessionId'], ['ack']);

  // office.crypto.* 加密 Office 文档解密（Node 域系统能力）。
  registerPair('office.crypto.decrypt', ['filePath', 'password'], ['bytes']);

  registerPair('resource.resolve', ['resourceId']);
  schemaRegistry.register('schemas/resource.open.request.json', validateResourceOpenRequest);
  schemaRegistry.register('schemas/resource.open.response.json', objectWithKeys(['result']));
  registerPair('resource.readMetadata', ['resourceId']);
  registerPair('resource.readBinary', ['resourceId']);
  schemaRegistry.register('schemas/resource.convertTiffToPng.request.json', validateResourceConvertTiffToPngRequest);
  schemaRegistry.register('schemas/resource.convertTiffToPng.response.json', objectWithKeys(['outputFile', 'mimeType', 'sourceMimeType']));
  schemaRegistry.register('schemas/resource.extractVideoFrame.request.json', validateResourceExtractVideoFrameRequest);
  schemaRegistry.register('schemas/resource.extractVideoFrame.response.json', objectWithKeys(['outputFile', 'mimeType', 'sourceMimeType', 'format', 'frameTimeSeconds']));

  registerPair('config.get', ['key']);
  registerPair('config.set', ['key', 'value']);
  registerPair('config.batchSet', ['entries']);
  registerPair('config.reset', []);

  registerPair('theme.list', []);
  registerPair('theme.apply', ['id']);
  registerPair('theme.getCurrent', []);
  registerPair('theme.getAllCss', []);
  registerPair('theme.resolve', ['chain'], ['resolved', 'tokens', 'diagnostics', 'summary']);
  registerPair('theme.contract.get', [], ['schemaVersion', 'themeId', 'themeVersion', 'contractVersion', 'components', 'summary']);

  registerPair('i18n.getCurrent', []);
  registerPair('i18n.setCurrent', ['locale']);
  registerPair('i18n.translate', ['key']);
  registerPair('i18n.listLocales', []);

  schemaRegistry.register('schemas/command.register.request.json', validateCommandRegisterRequest);
  schemaRegistry.register('schemas/command.register.response.json', objectWithKeys(['command']));
  schemaRegistry.register('schemas/command.unregister.request.json', validateCommandIdRequest);
  schemaRegistry.register('schemas/command.unregister.response.json', objectWithKeys(['ack']));
  schemaRegistry.register('schemas/command.get.request.json', validateCommandIdRequest);
  schemaRegistry.register('schemas/command.get.response.json', objectWithKeys([]));
  schemaRegistry.register('schemas/command.list.request.json', validateCommandListRequest);
  schemaRegistry.register('schemas/command.list.response.json', objectWithKeys(['commands']));
  schemaRegistry.register('schemas/command.setState.request.json', validateCommandSetStateRequest);
  schemaRegistry.register('schemas/command.setState.response.json', objectWithKeys(['command']));
  schemaRegistry.register('schemas/command.invoke.request.json', validateCommandInvokeRequest);
  schemaRegistry.register('schemas/command.invoke.response.json', objectWithKeys(['commandId', 'invocationId', 'dispatched', 'command']));

  schemaRegistry.register('schemas/cli.command.list.request.json', validateCliCommandQueryRequest);
  schemaRegistry.register('schemas/cli.command.list.response.json', objectWithKeys(['index', 'commands']));
  schemaRegistry.register('schemas/cli.command.get.request.json', validateCliCommandQueryRequest);
  schemaRegistry.register('schemas/cli.command.get.response.json', objectWithKeys([]));
  schemaRegistry.register('schemas/cli.command.resolve.request.json', validateCliCommandQueryRequest);
  schemaRegistry.register('schemas/cli.command.resolve.response.json', objectWithKeys(['conflicts']));

  schemaRegistry.register('schemas/cli.task.create.request.json', validateCliTaskCreateRequest);
  schemaRegistry.register('schemas/cli.task.create.response.json', objectWithKeys(['task']));
  schemaRegistry.register('schemas/cli.task.bindInvocation.request.json', validateCliTaskBindRequest);
  schemaRegistry.register('schemas/cli.task.bindInvocation.response.json', objectWithKeys(['task']));
  schemaRegistry.register('schemas/cli.task.get.request.json', validateCliTaskRequest);
  schemaRegistry.register('schemas/cli.task.get.response.json', objectWithKeys(['task']));
  schemaRegistry.register('schemas/cli.task.progress.request.json', validateCliTaskProgressRequest);
  schemaRegistry.register('schemas/cli.task.progress.response.json', objectWithKeys(['task']));
  schemaRegistry.register('schemas/cli.task.complete.request.json', validateCliTaskCompleteRequest);
  schemaRegistry.register('schemas/cli.task.complete.response.json', objectWithKeys(['task']));
  schemaRegistry.register('schemas/cli.task.fail.request.json', validateCliTaskFailRequest);
  schemaRegistry.register('schemas/cli.task.fail.response.json', objectWithKeys(['task']));
  schemaRegistry.register('schemas/cli.task.cancel.request.json', validateCliTaskRequest);
  schemaRegistry.register('schemas/cli.task.cancel.response.json', objectWithKeys(['task']));

  registerPair('surface.open', ['request'], ['surface']);
  registerPair('surface.focus', ['surfaceId'], ['ack']);
  registerPair('surface.resize', ['surfaceId', 'width', 'height'], ['ack']);
  registerPair('surface.setState', ['surfaceId', 'state'], ['ack']);
  registerPair('surface.getState', ['surfaceId'], ['state']);
  registerPair('surface.close', ['surfaceId'], ['ack']);
  registerPair('surface.list', [], ['surfaces']);

  registerPair('transfer.openPath', ['path'], ['ack']);
  registerPair('transfer.openExternal', ['url'], ['ack']);
  registerPair('transfer.revealInShell', ['path'], ['ack']);
  registerPair('transfer.share', ['input'], ['shared']);

  registerPair('association.getCapabilities', [], ['capabilities']);
  registerPair('association.openPath', ['path'], ['result']);
  registerPair('association.openUrl', ['url'], ['result']);

  registerPair('window.open', ['config'], ['window']);
  registerPair('window.focus', ['windowId'], ['ack']);
  registerPair('window.resize', ['windowId', 'width', 'height'], ['ack']);
  registerPair('window.setState', ['windowId', 'state'], ['ack']);
  registerPair('window.getState', ['windowId'], ['state']);
  registerPair('window.close', ['windowId'], ['ack']);

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
  schemaRegistry.register('schemas/platform.renderHtmlToPdf.request.json', validatePlatformRenderHtmlToPdfRequest);
  schemaRegistry.register('schemas/platform.renderHtmlToPdf.response.json', objectWithKeys(['outputFile']));
  schemaRegistry.register('schemas/platform.renderHtmlToImage.request.json', validatePlatformRenderHtmlToImageRequest);
  schemaRegistry.register('schemas/platform.renderHtmlToImage.response.json', objectWithKeys(['outputFile', 'format']));

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
  registerPair('plugin.listHandlers', [], ['handlers']);
  registerPair('plugin.init', ['pluginId']);
  registerPair('plugin.handshake.complete', ['sessionId', 'nonce']);

  schemaRegistry.register('schemas/module.listProviders.request.json', validateModuleListProvidersRequest);
  schemaRegistry.register('schemas/module.listProviders.response.json', objectWithKeys(['providers']));
  schemaRegistry.register('schemas/module.resolve.request.json', validateModuleResolveRequest);
  schemaRegistry.register('schemas/module.resolve.response.json', objectWithKeys(['provider']));
  schemaRegistry.register('schemas/module.invoke.request.json', validateModuleInvokeRequest);
  schemaRegistry.register('schemas/module.invoke.response.json', validateModuleInvokeResponse);
  schemaRegistry.register('schemas/module.job.get.request.json', validateModuleJobRequest);
  schemaRegistry.register('schemas/module.job.get.response.json', objectWithKeys(['job']));
  schemaRegistry.register('schemas/module.job.cancel.request.json', validateModuleJobRequest);
  schemaRegistry.register('schemas/module.job.cancel.response.json', objectWithKeys(['ack']));

  registerPair('platform.getInfo', [], ['info']);
  registerPair('platform.getCapabilities', [], ['capabilities']);
  registerPair('platform.getScreenInfo', [], ['screen']);
  registerPair('platform.listScreens', [], ['screens']);
  registerPair('platform.openExternal', ['url'], ['ack']);

  registerPair('log.write', ['level', 'message']);
  registerPair('log.query', []);
  registerPair('log.export', []);

  registerPair('credential.get', ['ref']);
  registerPair('credential.set', ['ref', 'value']);
  registerPair('credential.delete', ['ref']);
  registerPair('credential.rotate', ['ref']);

  registerPair('card.pack', ['cardDir', 'outputPath'], ['cardFile']);
  registerPair('card.unpack', ['cardFile', 'outputDir'], ['outputDir']);
  registerPair('card.readMetadata', ['cardFile'], ['metadata']);
  registerPair('card.readInfo', ['cardFile'], ['info']);
  registerPair('card.parse', ['cardFile']);
  schemaRegistry.register('schemas/card.render.request.json', validateCardRenderRequest);
  schemaRegistry.register('schemas/card.render.response.json', objectWithKeys(['view']));
  registerPair('card.renderCover', ['cardFile'], ['view']);
  schemaRegistry.register('schemas/card.renderEditor.request.json', validateCardRenderEditorRequest);
  schemaRegistry.register('schemas/card.renderEditor.response.json', objectWithKeys(['view']));
  registerPair('card.releaseRenderSession', ['sessionId'], ['ack']);
  registerPair('card.resolveDocumentPath', ['documentUrl'], ['path']);
  registerPair('card.resolveResourceUrl', ['cardRootDir', 'resourcePath'], ['uri']);
  registerPair('card.validate', ['cardFile']);
  registerPair('card.open', ['cardFile'], ['result']);
  registerPair('card.init', ['parentPath', 'name'], ['cardDir', 'cardId', 'sessionId', 'snapshot']);
  registerPair('card.session.open', ['cardDir'], ['sessionId', 'snapshot']);
  registerPair('card.session.get', ['sessionId'], ['snapshot']);
  registerPair('card.session.updateBasicCard', ['sessionId', 'basicCardId', 'data'], ['snapshot']);
  registerPair('card.session.addBasicCard', ['sessionId', 'type'], ['snapshot']);
  registerPair('card.session.removeBasicCard', ['sessionId', 'basicCardId'], ['snapshot']);
  registerPair('card.session.moveBasicCard', ['sessionId', 'basicCardId', 'newPosition'], ['snapshot']);
  registerPair('card.session.updateMetadata', ['sessionId', 'patch'], ['snapshot']);
  registerPair('card.session.updateCover', ['sessionId', 'html'], ['snapshot']);
  registerPair('card.session.persist', ['sessionId'], ['snapshot']);
  registerPair('card.session.undo', ['sessionId'], ['snapshot']);
  registerPair('card.session.redo', ['sessionId'], ['snapshot']);
  registerPair('card.session.history', ['sessionId'], ['history']);
  registerPair('card.session.close', ['sessionId'], ['ack']);

  registerPair('box.pack', ['boxDir', 'outputPath'], ['boxFile']);
  registerPair('box.unpack', ['boxFile', 'outputDir'], ['outputDir']);
  registerPair('box.inspect', ['boxFile'], ['inspection']);
  registerPair('box.validate', ['boxFile'], ['validationResult']);
  registerPair('box.readMetadata', ['boxFile'], ['metadata']);
  registerPair('box.listLayoutDescriptors', [], ['descriptors']);
  registerPair('box.readLayoutDescriptor', ['layoutType'], ['descriptor']);
  registerPair('box.normalizeLayoutConfig', ['layoutType', 'config'], ['config']);
  registerPair('box.validateLayoutConfig', ['layoutType', 'config'], ['validation']);
  registerPair('box.getLayoutInitialQuery', ['layoutType', 'config'], ['query']);
  registerPair('box.renderLayoutFrame', ['layoutType', 'sessionId', 'box', 'initialView', 'config'], ['view']);
  registerPair('box.renderLayoutEditor', ['layoutType', 'entries', 'initialConfig'], ['view']);
  registerPair('box.releaseRenderSession', ['sessionId'], ['ack']);
  registerPair('box.renderCover', ['boxFile'], ['view']);
  schemaRegistry.register('schemas/box.openView.request.json', objectWithKeys(['boxFile']));
  schemaRegistry.register('schemas/box.openView.response.json', objectWithKeys(['sessionId', 'box', 'initialView']));
  registerPair('box.listEntries', ['sessionId'], ['page']);
  registerPair('box.readEntryDetail', ['sessionId', 'entryIds', 'fields'], ['items']);
  registerPair('box.renderEntryCover', ['sessionId', 'entryId'], ['view']);
  registerPair('box.renderEntryDocument', ['sessionId', 'entryId'], ['view']);
  registerPair('box.releaseEntryDocument', ['sessionId', 'renderSessionId'], ['ack']);
  registerPair('box.resolveEntryResource', ['sessionId', 'entryId', 'resource'], ['resource']);
  registerPair('box.openEntry', ['sessionId', 'entryId'], ['result']);
  registerPair('box.readBoxAsset', ['sessionId', 'assetPath'], ['resource']);
  registerPair('box.prefetchEntries', ['sessionId', 'entryIds', 'targets'], ['ack']);
  registerPair('box.closeView', ['sessionId'], ['ack']);

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
