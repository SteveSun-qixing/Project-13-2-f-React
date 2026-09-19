import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PAL_ERROR_CODES } from '../src/platform/errors.js';
import { createMacClipboardPort } from '../src/platform/mac/clipboard-port.js';
import { createMacMenuPort } from '../src/platform/mac/menu-port.js';
import { createMacNotificationPort } from '../src/platform/mac/notification-port.js';
import { createMacShortcutPort, isValidAccelerator } from '../src/platform/mac/shortcut-port.js';
import { createMacTrayController } from '../src/platform/mac/tray-port.js';
import {
  MockClipboardModule,
  MockMenuModule,
  MockNativeImageModule,
  MockNotificationInstance,
  MockNotificationModule,
  MockShortcutModule,
  MockTrayInstance,
  MockTrayModule,
} from './helpers/electron-mock.js';

describe('createMacNotificationPort', () => {
  let notification: MockNotificationModule;

  beforeEach(() => {
    MockNotificationInstance.reset();
    notification = new MockNotificationModule();
  });

  it('should fail with NOTIFICATION_UNAVAILABLE when the system does not support it', async () => {
    notification.supported = false;
    await expect(createMacNotificationPort(notification.Notification).send({ title: '提醒' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.NOTIFICATION_UNAVAILABLE,
    });
    expect(notification.instances).toHaveLength(0);
  });

  it('should send title, body, silent and icon path', async () => {
    await createMacNotificationPort(notification.Notification).send({
      title: '下载完成',
      body: '卡片已保存',
      silent: true,
      iconPath: '/icons/app.png',
    });

    expect(notification.instances).toHaveLength(1);
    const instance = notification.instances[0];
    expect(instance?.options).toEqual({
      title: '下载完成',
      body: '卡片已保存',
      silent: true,
      icon: '/icons/app.png',
    });
    expect(instance?.showCount).toBe(1);
  });

  it('should omit optional fields when they are not provided', async () => {
    await createMacNotificationPort(notification.Notification).send({ title: '仅标题' });
    expect(notification.instances[0]?.options).toEqual({ title: '仅标题' });
  });

  it('should proceed when isSupported is not implemented', async () => {
    notification.withoutIsSupported();
    await createMacNotificationPort(notification.Notification).send({ title: '提醒' });
    expect(notification.instances).toHaveLength(1);
  });

  it('should normalize show failures', async () => {
    notification.showError = new Error('boom');
    await expect(createMacNotificationPort(notification.Notification).send({ title: '提醒' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.NOTIFICATION_FAILED,
    });
  });

  it('should reject aborted calls', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createMacNotificationPort(notification.Notification).send({
        title: '提醒',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: PAL_ERROR_CODES.BRIDGE_CANCELLED });
  });
});

describe('createMacClipboardPort', () => {
  let clipboard: MockClipboardModule;

  beforeEach(() => {
    clipboard = new MockClipboardModule();
  });

  it('should normalize empty clipboard text to null', async () => {
    await expect(createMacClipboardPort(clipboard).readText()).resolves.toBeNull();
  });

  it('should read and write text', async () => {
    const port = createMacClipboardPort(clipboard);
    await port.writeText('薯片');
    await expect(port.readText()).resolves.toBe('薯片');
    expect(clipboard.writeCount).toBe(1);
    expect(clipboard.readCount).toBe(1);
  });

  it('should normalize read and write failures', async () => {
    const port = createMacClipboardPort(clipboard);
    clipboard.failRead = true;
    await expect(port.readText()).rejects.toMatchObject({
      code: PAL_ERROR_CODES.CLIPBOARD_UNAVAILABLE,
      retryable: true,
    });
    clipboard.failRead = false;
    clipboard.failWrite = true;
    await expect(port.writeText('x')).rejects.toMatchObject({
      code: PAL_ERROR_CODES.CLIPBOARD_UNAVAILABLE,
    });
  });
});

describe('createMacMenuPort', () => {
  let menu: MockMenuModule;
  let tray: MockTrayModule;
  let nativeImage: MockNativeImageModule;

  beforeEach(() => {
    MockTrayInstance.reset();
    menu = new MockMenuModule();
    tray = new MockTrayModule();
    nativeImage = new MockNativeImageModule();
  });

  /** 创建菜单端口与托盘控制器。 */
  function createPorts() {
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    const port = createMacMenuPort({
      Menu: menu,
      setTrayContextMenu: (built) => controller.setContextMenu(built),
    });
    return { controller, port };
  }

  it('should prepend the macOS app menu and set the application menu', async () => {
    const { port } = createPorts();
    await port.set('app', [
      { id: 'file.open', label: '打开' },
      { id: 'edit.undo', label: '撤销', enabled: false },
    ]);

    const template = menu.templates[0];
    expect(template?.[0]).toMatchObject({ role: 'appMenu' });
    expect(template?.[1]).toMatchObject({ id: 'file.open', label: '打开', enabled: true });
    expect(template?.[2]).toMatchObject({ id: 'edit.undo', label: '撤销', enabled: false });
    expect(menu.applicationMenu?.items).toHaveLength(3);
  });

  it('should map nested submenus and command clicks', async () => {
    const { port } = createPorts();
    const onActivate = vi.fn();
    await port.set(
      'app',
      [
        {
          id: 'view',
          label: '视图',
          submenu: [
            { id: 'view.zoom', label: '放大', command: 'view.zoom' },
            { id: 'view.reset', label: '重置' },
          ],
        },
      ],
      { onActivate },
    );

    const root = menu.templates[0]?.find((item) => item.id === 'view');
    expect(root?.submenu).toHaveLength(2);
    expect(root?.click).toBeUndefined();

    root?.submenu?.[0]?.click?.();
    expect(onActivate).toHaveBeenCalledWith({ id: 'view.zoom', command: 'view.zoom' });

    root?.submenu?.[1]?.click?.();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('should fail to set a tray menu before the tray exists', async () => {
    const { port } = createPorts();
    await expect(port.set('tray', [{ id: 'a', label: 'A' }])).rejects.toMatchObject({
      code: PAL_ERROR_CODES.MENU_SET_FAILED,
      details: { reason: 'tray-not-created' },
    });
  });

  it('should set the tray context menu once the tray exists', async () => {
    const { controller, port } = createPorts();
    await controller.port.set({ iconPath: '/icons/tray.png' });
    await port.set('tray', [{ id: 'a', label: 'A' }]);

    expect(tray.instances[0]?.contextMenu).toBeInstanceOf(Object);
    expect(tray.instances[0]?.contextMenu).not.toBeNull();
  });

  it('should normalize build failures', async () => {
    const { port } = createPorts();
    menu.failBuild = true;
    await expect(port.set('app', [{ id: 'a', label: 'A' }])).rejects.toMatchObject({
      code: PAL_ERROR_CODES.MENU_SET_FAILED,
    });
  });
});

describe('createMacTrayController', () => {
  let tray: MockTrayModule;
  let nativeImage: MockNativeImageModule;

  beforeEach(() => {
    MockTrayInstance.reset();
    tray = new MockTrayModule();
    nativeImage = new MockNativeImageModule();
  });

  it('should require an icon path or a configured default', async () => {
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    await expect(controller.port.set({})).rejects.toMatchObject({
      code: PAL_ERROR_CODES.TRAY_ICON_INVALID,
    });
    expect(tray.instances).toHaveLength(0);
  });

  it('should use the default icon path when none is provided', async () => {
    const controller = createMacTrayController(
      { Tray: tray.Tray, nativeImage },
      { defaultIconPath: '/icons/default.png' },
    );
    await controller.port.set({ tooltip: '薯片' });

    expect(tray.instances).toHaveLength(1);
    expect(nativeImage.createdPaths).toEqual(['/icons/default.png']);
    expect(tray.instances[0]?.tooltip).toBe('薯片');
  });

  it('should reject undecodable icons', async () => {
    nativeImage.invalidPaths.add('/icons/broken.png');
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    await expect(controller.port.set({ iconPath: '/icons/broken.png' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.TRAY_ICON_INVALID,
    });
  });

  it('should normalize decode and creation failures', async () => {
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    nativeImage.failCreate = true;
    await expect(controller.port.set({ iconPath: '/icons/tray.png' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.TRAY_ICON_INVALID,
    });

    nativeImage.failCreate = false;
    tray.failConstruct = true;
    await expect(controller.port.set({ iconPath: '/icons/tray.png' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.TRAY_SET_FAILED,
    });
  });

  it('should update icon and tooltip on an existing tray', async () => {
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    await controller.port.set({ iconPath: '/icons/a.png', tooltip: 'A' });
    await controller.port.set({ iconPath: '/icons/b.png', tooltip: 'B' });

    expect(tray.instances).toHaveLength(1);
    expect(nativeImage.createdPaths).toEqual(['/icons/a.png', '/icons/b.png']);
    expect(tray.instances[0]?.tooltip).toBe('B');
  });

  it('should normalize setImage failures', async () => {
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    await controller.port.set({ iconPath: '/icons/a.png' });
    tray.failSetImage = true;
    await expect(controller.port.set({ iconPath: '/icons/b.png' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.TRAY_SET_FAILED,
    });
  });

  it('should hide and recreate the tray when visibility toggles', async () => {
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    await controller.port.set({ iconPath: '/icons/a.png' });
    await controller.port.set({ visible: false });
    expect(tray.instances[0]?.destroyed).toBe(true);

    await controller.port.set({ iconPath: '/icons/a.png' });
    expect(tray.instances).toHaveLength(2);
    expect(tray.instances[1]?.destroyed).toBe(false);
  });

  it('should emit click signals and stop after dispose', async () => {
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    await controller.port.set({ iconPath: '/icons/a.png' });
    const listener = vi.fn();
    const subscription = controller.port.onClicked(listener);

    tray.instances[0]?.emitClick('click');
    tray.instances[0]?.emitClick('right-click');
    expect(listener).toHaveBeenNthCalledWith(1, 'left');
    expect(listener).toHaveBeenNthCalledWith(2, 'right');

    controller.port.onClicked(listener).dispose();
    subscription.dispose();
    tray.instances[0]?.emitClick('click');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('should expose the tray context menu sink before creation', () => {
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    expect(controller.setContextMenu({ items: [] })).toBe(false);
  });

  it('should dispose listeners and the tray idempotently', async () => {
    const controller = createMacTrayController({ Tray: tray.Tray, nativeImage });
    await controller.port.set({ iconPath: '/icons/a.png' });
    const listener = vi.fn();
    controller.port.onClicked(listener);

    controller.dispose();
    controller.dispose();
    expect(tray.instances[0]?.destroyed).toBe(true);
  });
});

describe('isValidAccelerator', () => {
  it('should accept valid accelerators', () => {
    for (const accelerator of [
      'CommandOrControl+S',
      'Cmd+Q',
      'Alt+Shift+F1',
      'F5',
      'F24',
      'Space',
      'Escape',
      'Return',
      'Up',
      'Plus',
      'Command+,',
      'Command+Shift+=',
      'A',
      'Ctrl+1',
      'Super+Alt+MediaPlayPause',
    ]) {
      expect(isValidAccelerator(accelerator), accelerator).toBe(true);
    }
  });

  it('should reject invalid accelerators', () => {
    for (const accelerator of [
      '',
      'Command+',
      '+S',
      'Command++S',
      'Foo+S',
      'Shift+Shift+A',
      'Command+Shift',
      'F25',
      'Command+F25',
      'Command+中文',
      'Command+Space+Space',
    ]) {
      expect(isValidAccelerator(accelerator), accelerator).toBe(false);
    }
  });
});

describe('createMacShortcutPort', () => {
  let shortcut: MockShortcutModule;

  beforeEach(() => {
    shortcut = new MockShortcutModule();
  });

  it('should register an accelerator and trigger its callback', async () => {
    const port = createMacShortcutPort(shortcut);
    const onTrigger = vi.fn();
    await port.register('plugin.hello.toggle', 'CommandOrControl+Shift+H', onTrigger);

    expect(shortcut.registered.has('CommandOrControl+Shift+H')).toBe(true);
    shortcut.trigger('CommandOrControl+Shift+H');
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('should reject invalid ids or accelerators', async () => {
    const port = createMacShortcutPort(shortcut);
    await expect(port.register('', 'CommandOrControl+H', () => undefined)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.SHORTCUT_ACCELERATOR_INVALID,
    });
    await expect(port.register('id', 'Foo+H', () => undefined)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.SHORTCUT_ACCELERATOR_INVALID,
    });
  });

  it('should report conflicts with other bindings', async () => {
    const port = createMacShortcutPort(shortcut);
    shortcut.registered.set('CommandOrControl+K', () => undefined);
    await expect(port.register('id', 'CommandOrControl+K', () => undefined)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.SHORTCUT_CONFLICT,
    });
  });

  it('should overwrite the binding when the same id registers again', async () => {
    const port = createMacShortcutPort(shortcut);
    const first = vi.fn();
    const second = vi.fn();
    await port.register('id', 'CommandOrControl+1', first);
    await port.register('id', 'CommandOrControl+2', second);

    expect(shortcut.registered.has('CommandOrControl+1')).toBe(false);
    expect(shortcut.registered.has('CommandOrControl+2')).toBe(true);
    shortcut.trigger('CommandOrControl+2');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('should normalize registration failures and system rejection', async () => {
    const port = createMacShortcutPort(shortcut);
    shortcut.registerResult = false;
    await expect(port.register('id', 'CommandOrControl+H', () => undefined)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.SHORTCUT_REGISTER_FAILED,
    });

    shortcut.registerResult = true;
    shortcut.registerError = new Error('boom');
    await expect(port.register('id', 'CommandOrControl+H', () => undefined)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.SHORTCUT_REGISTER_FAILED,
    });
  });

  it('should unregister idempotently', async () => {
    const port = createMacShortcutPort(shortcut);
    await port.register('id', 'CommandOrControl+H', () => undefined);
    await port.unregister('id');
    await port.unregister('id');
    await port.unregister('missing');

    expect(shortcut.registered.has('CommandOrControl+H')).toBe(false);
  });

  it('should tolerate unregister failures from the system', async () => {
    const port = createMacShortcutPort(shortcut);
    await port.register('id', 'CommandOrControl+H', () => undefined);
    shortcut.unregisterError = new Error('already released');
    await expect(port.unregister('id')).resolves.toBeUndefined();
  });

  it('should reject aborted calls', async () => {
    const port = createMacShortcutPort(shortcut);
    const controller = new AbortController();
    controller.abort();
    await expect(
      port.register('id', 'CommandOrControl+H', () => undefined, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: PAL_ERROR_CODES.BRIDGE_CANCELLED });
  });
});
