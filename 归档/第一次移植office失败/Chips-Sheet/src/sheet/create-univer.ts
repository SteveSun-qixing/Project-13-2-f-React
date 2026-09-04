/**
 * Univer 引导器（本地复刻 @univerjs/presets 的 createUniver 组合逻辑，
 * 移植自 GenOffice apps/sheets/src/renderer/create-univer.ts，Apache-2.0）。
 *
 * 刻意避开 @univerjs/presets 元包：该元包会连带拉取全部 @univerjs-pro/*
 * 专有包（npm 许可 "None"）。这里只依赖开源 Apache-2.0 的
 * @univerjs/preset-sheets-* 单包，并在此复刻小型组合助手（协作模式不启用）。
 */
import { LogLevel, Univer, type DependencyOverride, type IUniverConfig, type Plugin, type PluginCtor } from "@univerjs/core";
import { FUniver } from "@univerjs/core/lib/facade";

type PluginEntry = PluginCtor<Plugin> | [PluginCtor<Plugin>, ConstructorParameters<PluginCtor<Plugin>>[0]];

/** 一组插件及其默认配置（与 preset 包导出结构一致）。 */
export interface IPreset {
  plugins: PluginEntry[];
}

export interface CreateUniverOptions extends Partial<IUniverConfig> {
  presets: Array<IPreset | [IPreset, { lazy?: boolean }]>;
  plugins?: PluginEntry[];
  override?: DependencyOverride;
}

export function createUniver(options: CreateUniverOptions): { univer: Univer; univerAPI: FUniver } {
  const { presets, plugins, override = [], ...univerConfig } = options;
  const univer = new Univer({ logLevel: LogLevel.WARN, ...univerConfig, override });

  // 后注册的 preset 覆盖先注册的（与上游 helper 相同的去重语义）；
  // 显式列出的插件不允许与 preset 提供的插件冲突。
  const registry = new Map<string, { plugin: PluginCtor<Plugin>; options: unknown }>();
  for (const entry of presets) {
    const preset = Array.isArray(entry) ? entry[0] : entry;
    for (const pluginEntry of preset.plugins) {
      const [plugin, pluginOptions] = Array.isArray(pluginEntry) ? pluginEntry : [pluginEntry, undefined];
      registry.delete(plugin.pluginName);
      registry.set(plugin.pluginName, { plugin, options: pluginOptions });
    }
  }
  for (const pluginEntry of plugins ?? []) {
    const [plugin, pluginOptions] = Array.isArray(pluginEntry) ? pluginEntry : [pluginEntry, undefined];
    if (registry.has(plugin.pluginName)) {
      throw new Error(
        `插件 ${plugin.pluginName} 已被 preset 或其他途径注册！` +
          "重复注册可能引发问题，请检查注册代码。",
      );
    }
    registry.set(plugin.pluginName, { plugin, options: pluginOptions });
  }
  for (const { plugin, options: pluginOptions } of registry.values()) {
    univer.registerPlugin(plugin, pluginOptions);
  }

  return { univer, univerAPI: FUniver.newAPI(univer) };
}
