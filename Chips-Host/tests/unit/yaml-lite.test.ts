import { describe, expect, it } from 'vitest';
import { parseYamlLite } from '../../src/shared/yaml-lite';

describe('yaml-lite parser', () => {
  it('parses inline nested arrays in metadata tags', () => {
    const parsed = parseYamlLite(`
chip_standards_version: "1.0.0"
name: "日本旅行 2026"
tags:
  - "旅行"
  - ["地点", "日本", "东京"]
  - ["评分", "五星"]
content_warning: []
`);

    expect(parsed.tags).toEqual(['旅行', ['地点', '日本', '东京'], ['评分', '五星']]);
    expect(parsed.content_warning).toEqual([]);
  });

  it('parses arrays of objects in structure declarations', () => {
    const parsed = parseYamlLite(`
structure:
  - id: "6at8Obawde"
    type: "base.richtext"
  - id: "Qzea3RKc0A"
    type: "base.richtext"

manifest:
  card_count: 2
  resource_count: 0
  resources: []
`);

    expect(parsed).toEqual({
      structure: [
        {
          id: '6at8Obawde',
          type: 'base.richtext'
        },
        {
          id: 'Qzea3RKc0A',
          type: 'base.richtext'
        }
      ],
      manifest: {
        card_count: 2,
        resource_count: 0,
        resources: []
      }
    });
  });
});
