import type { BasecardConfigRecord, BasecardDescriptor, EditorValidationResult } from './contracts';
import { imageBasecardDescriptor } from './registrations/image';
import { richtextBasecardDescriptor } from './registrations/richtext';

const basecardDescriptors = [
  imageBasecardDescriptor,
  richtextBasecardDescriptor,
] satisfies BasecardDescriptor[];

const descriptorMap = new Map<string, BasecardDescriptor>();

for (const descriptor of basecardDescriptors) {
  descriptorMap.set(descriptor.cardType, descriptor);
}

export function getRegisteredBasecardDescriptors(): BasecardDescriptor[] {
  return basecardDescriptors;
}

export function getBasecardDescriptor(cardType: string): BasecardDescriptor | null {
  return descriptorMap.get(cardType) ?? null;
}

export function assertBasecardDescriptor(cardType: string): BasecardDescriptor {
  const descriptor = getBasecardDescriptor(cardType);
  if (!descriptor) {
    throw new Error(`未找到基础卡片描述符: ${cardType}`);
  }
  return descriptor;
}

export function createInitialBasecardConfig(cardType: string, baseCardId: string): BasecardConfigRecord {
  const descriptor = getBasecardDescriptor(cardType);
  if (!descriptor) {
    return { id: baseCardId };
  }
  return descriptor.createInitialConfig(baseCardId);
}

export function normalizeBasecardConfig(
  cardType: string,
  baseCardId: string,
  input: BasecardConfigRecord,
): BasecardConfigRecord {
  const descriptor = getBasecardDescriptor(cardType);
  if (!descriptor) {
    return {
      ...input,
      id: baseCardId,
    };
  }
  return descriptor.normalizeConfig(input, baseCardId);
}

export function validateBasecardConfig(cardType: string, config: BasecardConfigRecord): EditorValidationResult {
  const descriptor = getBasecardDescriptor(cardType);
  if (!descriptor) {
    return {
      valid: true,
      errors: {},
    };
  }
  return descriptor.validateConfig(config);
}
