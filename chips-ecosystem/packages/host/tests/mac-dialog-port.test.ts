import { beforeEach, describe, expect, it } from 'vitest';

import { PAL_ERROR_CODES } from '../src/platform/errors.js';
import { createMacDialogPort } from '../src/platform/mac/dialog-port.js';
import { MockDialogModule } from './helpers/electron-mock.js';

let dialog: MockDialogModule;

beforeEach(() => {
  dialog = new MockDialogModule();
});

describe('createMacDialogPort · open', () => {
  it('should use openFile by default and omit empty filters', async () => {
    const port = createMacDialogPort(dialog);
    const result = await port.open();

    expect(dialog.lastOpenOptions).toEqual({ properties: ['openFile'] });
    expect(result).toEqual({ canceled: true, paths: [] });
  });

  it('should map directory, multiple and filters to Electron options', async () => {
    dialog.openResult = { canceled: false, filePaths: ['/Users/tester/Documents/a.card'] };
    const port = createMacDialogPort(dialog);

    const result = await port.open({
      title: '选择卡片文件',
      multiple: true,
      directory: true,
      filters: [{ name: '薯片卡片', extensions: ['.card', '.box'] }],
    });

    expect(dialog.lastOpenOptions).toEqual({
      properties: ['openDirectory', 'multiSelections'],
      title: '选择卡片文件',
      filters: [{ name: '薯片卡片', extensions: ['card', 'box'] }],
    });
    expect(result).toEqual({
      canceled: false,
      paths: ['/Users/tester/Documents/a.card'],
    });
  });

  it('should treat unexpected results as canceled', async () => {
    dialog.openQueue.push({ canceled: false });
    const port = createMacDialogPort(dialog);
    await expect(port.open()).resolves.toEqual({ canceled: true, paths: [] });
  });

  it('should normalize dialog failures', async () => {
    dialog.openError = new Error('boom');
    await expect(createMacDialogPort(dialog).open()).rejects.toMatchObject({
      code: PAL_ERROR_CODES.DIALOG_FAILED,
      retryable: true,
    });
  });

  it('should reject aborted calls', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createMacDialogPort(dialog).open({ signal: controller.signal })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_CANCELLED,
    });
  });
});

describe('createMacDialogPort · save', () => {
  it('should pass title, defaultPath and filters', async () => {
    dialog.saveResult = { canceled: false, filePath: '/Users/tester/Desktop/new.card' };
    const port = createMacDialogPort(dialog);

    const result = await port.save({
      title: '保存卡片',
      defaultPath: '${userDesktop}/new.card',
      filters: [{ name: '薯片卡片', extensions: ['card'] }],
    });

    expect(dialog.lastSaveOptions).toEqual({
      title: '保存卡片',
      defaultPath: '${userDesktop}/new.card',
      filters: [{ name: '薯片卡片', extensions: ['card'] }],
    });
    expect(result).toEqual({ canceled: false, path: '/Users/tester/Desktop/new.card' });
  });

  it('should normalize cancellation and empty paths', async () => {
    dialog.saveResult = { canceled: false, filePath: '' };
    await expect(createMacDialogPort(dialog).save()).resolves.toEqual({
      canceled: true,
      path: null,
    });
  });

  it('should normalize dialog failures', async () => {
    dialog.saveError = new Error('boom');
    await expect(createMacDialogPort(dialog).save()).rejects.toMatchObject({
      code: PAL_ERROR_CODES.DIALOG_FAILED,
    });
  });

  it('should reject expired calls', async () => {
    await expect(createMacDialogPort(dialog).save({ deadline: Date.now() - 1 })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_TIMEOUT,
    });
  });
});
