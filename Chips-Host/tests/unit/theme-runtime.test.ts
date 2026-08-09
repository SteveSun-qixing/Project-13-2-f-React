import { describe, expect, it } from 'vitest';
import { mergeThemeLayers, resolveThemeFromLayers } from '../../src/main/theme-runtime/resolve-algorithm';
import { buildThemeContractsView, validateThemeContractWithTokens } from '../../src/main/theme-runtime/contract-guard';
import { buildThemeScopeChain } from '../../src/main/theme-runtime/scope-chain';
import { toRenderThemeSnapshot } from '../../src/main/theme-runtime/render-bridge';
import { resolveNodeProps, type ThemeSnapshot as RenderThemeSnapshot } from '../../packages/unified-rendering/src';

describe('Theme Runtime', () => {
  it('resolves five-layer tokens and builds component token map', () => {
    const themeTokens: Record<string, unknown> = {
      ref: {
        white: '#ffffff',
        spacing: {
          md: '12cpx'
        }
      },
      sys: {
        text: {
          primary: '{white}'
        }
      },
      comp: {
        chips: {
          comp: {
            button: {
              background: '{white}'
            },
            dialog: {
              surface: '{white}'
            },
            grid: {
              gap: '{chips.layout.gap.md}'
            }
          }
        }
      },
      motion: {},
      layout: {
        chips: {
          layout: {
            gap: {
              md: '{spacing.md}'
            }
          }
        }
      }
    };

    const layers = mergeThemeLayers([{ id: 'chips.test.theme', tokens: themeTokens }]);
    const resolved = resolveThemeFromLayers(layers);

    expect(resolved.variables.white).toBe('#ffffff');
    expect(resolved.variables['text.primary']).toBe('#ffffff');
    expect(resolved.variables['chips.comp.button.background']).toBe('#ffffff');
    expect(resolved.variables['chips.comp.dialog.surface']).toBe('#ffffff');
    expect(resolved.variables['chips.layout.gap.md']).toBe('12cpx');
    expect(resolved.variables['chips.comp.grid.gap']).toBe('12cpx');

    expect(resolved.componentTokens.button!['chips.comp.button.background']).toBe('#ffffff');
    expect(resolved.componentTokens.dialog!['chips.comp.dialog.surface']).toBe('#ffffff');
    expect(resolved.componentTokens.grid!['chips.comp.grid.gap']).toBe('12cpx');
    expect(resolved.summary.status).toBe('complete');
  });

  it('resolves same-layer token references before cross-layer consumers', () => {
    const themeTokens: Record<string, unknown> = {
      ref: {
        chips: {
          ref: {
            color: {
              blue: '#0a84ff',
              red: '#ff3b30'
            }
          }
        }
      },
      sys: {
        chips: {
          sys: {
            color: {
              primary: '{chips.ref.color.blue}',
              danger: '{chips.ref.color.red}'
            },
            icon: {
              'color-accent': '{chips.sys.color.primary}',
              'color-danger': '{chips.sys.color.danger}'
            }
          }
        }
      },
      comp: {
        chips: {
          comp: {
            icon: {
              accent: '{chips.sys.icon.color-accent}',
              danger: '{chips.sys.icon.color-danger}'
            }
          }
        }
      },
      motion: {},
      layout: {}
    };

    const layers = mergeThemeLayers([{ id: 'chips.test.theme', tokens: themeTokens }]);
    const resolved = resolveThemeFromLayers(layers);

    expect(resolved.variables['chips.sys.color.primary']).toBe('#0a84ff');
    expect(resolved.variables['chips.sys.icon.color-accent']).toBe('#0a84ff');
    expect(resolved.variables['chips.sys.icon.color-danger']).toBe('#ff3b30');
    expect(resolved.variables['chips.comp.icon.accent']).toBe('#0a84ff');
    expect(resolved.variables['chips.comp.icon.danger']).toBe('#ff3b30');
  });

  it('rejects circular same-layer token references', () => {
    const themeTokens: Record<string, unknown> = {
      ref: {},
      sys: {
        chips: {
          sys: {
            color: {
              primary: '{chips.sys.color.accent}',
              accent: '{chips.sys.color.primary}'
            }
          }
        }
      },
      comp: {},
      motion: {},
      layout: {}
    };

    const layers = mergeThemeLayers([{ id: 'chips.test.theme', tokens: themeTokens }]);

    expect(() => resolveThemeFromLayers(layers)).toThrowError(
      expect.objectContaining({
        code: 'THEME_TOKEN_CYCLE',
        details: expect.objectContaining({
          path: ['chips.sys.color.primary', 'chips.sys.color.accent', 'chips.sys.color.primary']
        })
      })
    );
  });

  it('builds theme scope chain from context', () => {
    const chain = buildThemeScopeChain({
      globalId: null,
      appId: 'main-app',
      boxId: 'inbox',
      compositeCardId: 'overview',
      baseCardId: 'card-1',
      componentId: 'button-primary'
    });

    expect(chain.scopes).toEqual([
      'global',
      'app:main-app',
      'box:inbox',
      'composite-card:overview',
      'base-card:card-1',
      'component:button-primary'
    ]);
  });

  it('bridges resolved theme into unified rendering ThemeSnapshot', () => {
    const themeTokens: Record<string, unknown> = {
      ref: {
        white: '#ffffff'
      },
      sys: {
        text: {
          primary: '{white}'
        }
      },
      comp: {},
      motion: {},
      layout: {}
    };

    const layers = mergeThemeLayers([{ id: 'chips.test.theme', tokens: themeTokens }]);
    const resolved = resolveThemeFromLayers(layers);

    const snapshot: RenderThemeSnapshot = toRenderThemeSnapshot('chips.test.theme', resolved);
    const props = {
      tone: 'token.text.primary',
      other: 'value'
    };

    const resolvedProps = resolveNodeProps(props, snapshot, undefined);
    expect(resolvedProps.tone).toBe('#ffffff');
    expect(resolvedProps.other).toBe('value');
  });

  it('builds theme contract view with coverage and structured diagnostics', () => {
    const contract = {
      version: '1.0.0',
      components: [
        {
          name: 'button',
          scope: 'button',
          parts: ['root', 'label'],
          states: ['idle', 'hover'],
          tokens: ['chips.comp.button.root.surface.idle', 'chips.comp.button.label.color.idle'],
          optionalTokens: ['chips.comp.button.root.surface.hover'],
          a11yConstraints: [{ key: 'button.accessible-name' }],
          motionConstraints: [{ key: 'button.focus-visible' }]
        }
      ]
    };

    const view = buildThemeContractsView(
      { themeId: 'chips.test.theme', themeVersion: '1.0.0' },
      contract,
      {
        'chips.comp.button.root.surface.idle': '#ffffff'
      }
    );

    expect(view).toMatchObject({
      schemaVersion: '1.0.0',
      themeId: 'chips.test.theme',
      themeVersion: '1.0.0',
      contractVersion: '1.0.0',
      summary: {
        total: 2,
        blocking: 1,
        status: 'blocked'
      }
    });
    expect(view.components[0]).toMatchObject({
      component: 'button',
      scope: 'button',
      requiredTokens: ['chips.comp.button.root.surface.idle', 'chips.comp.button.label.color.idle'],
      optionalTokens: ['chips.comp.button.root.surface.hover'],
      coverage: {
        requiredTokenCount: 2,
        coveredRequiredTokenCount: 1,
        missingRequiredTokenCount: 1,
        optionalTokenCount: 1,
        coveredOptionalTokenCount: 0,
        missingOptionalTokenCount: 1,
        status: 'blocked'
      }
    });
    expect(view.components[0]?.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'THEME_REQUIRED_TOKEN_MISSING',
        messageKey: 'theme.diagnostics.requiredTokenMissing',
        themeId: 'chips.test.theme',
        component: 'button',
        part: 'label',
        state: 'idle',
        tokenKey: 'chips.comp.button.label.color.idle',
        layer: 'comp',
        blocking: true
      })
    );
  });

  it('rejects invalid contract with structured blocking diagnostics', () => {
    const contract = {
      version: '1.0.0',
      components: [
        {
          name: 'button',
          scope: 'button',
          parts: ['root'],
          states: ['idle'],
          tokens: ['chips.comp.button.root.surface.idle']
        }
      ]
    };

    expect(() => validateThemeContractWithTokens('chips.test.theme', contract, {})).toThrowError(
      expect.objectContaining({
        code: 'THEME_CONTRACT_INVALID',
        details: expect.objectContaining({
          diagnostics: [
            expect.objectContaining({
              code: 'THEME_REQUIRED_TOKEN_MISSING',
              component: 'button',
              tokenKey: 'chips.comp.button.root.surface.idle',
              blocking: true
            })
          ],
          summary: expect.objectContaining({
            blocking: 1,
            status: 'blocked'
          })
        })
      })
    );
  });
});
