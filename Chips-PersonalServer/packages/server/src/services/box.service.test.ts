import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boxesTable = {
  id: 'boxes.id',
  userId: 'boxes.user_id',
  createdAt: 'boxes.created_at',
};

const cardsTable = {
  cardFileId: 'cards.card_file_id',
  status: 'cards.status',
  visibility: 'cards.visibility',
};

let findFirstResult: Record<string, unknown> | null = null;
let cardsFindManyResult: Record<string, unknown>[] = [];
let insertedBoxResult: Record<string, unknown> | null = null;
let updatedBoxResult: Record<string, unknown> | null = null;
const insertValuesMock = vi.fn();
const updateSetMock = vi.fn();
const deleteWhereMock = vi.fn();
const deleteObjectMock = vi.fn();

vi.mock('../db/client', () => ({
  db: {
    query: {
      boxes: {
        findFirst: vi.fn(async () => findFirstResult),
      },
      cards: {
        findMany: vi.fn(async () => cardsFindManyResult),
      },
    },
    insert: vi.fn(() => ({
      values: insertValuesMock,
    })),
    update: vi.fn(() => ({
      set: updateSetMock,
    })),
    delete: vi.fn(() => ({
      where: deleteWhereMock,
    })),
  },
}));

vi.mock('../db/schema/boxes', () => ({
  boxes: boxesTable,
}));

vi.mock('../db/schema/cards', () => ({
  cards: cardsTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left, right) => ({ left, right, op: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
  isNull: vi.fn((column) => ({ column, op: 'isNull' })),
  desc: vi.fn((column) => ({ column, op: 'desc' })),
  count: vi.fn(() => ({ op: 'count' })),
  inArray: vi.fn((column, values) => ({ column, values, op: 'inArray' })),
}));

vi.mock('../storage/s3', () => ({
  deleteObject: deleteObjectMock,
}));

vi.mock('../storage/buckets', () => ({
  Bucket: {
    BOX_FILES: 'chips-box-files',
  },
}));

function mockInsertReturning(record: Record<string, unknown>) {
  insertValuesMock.mockReturnValue({
    returning: vi.fn(async () => [record]),
  });
}

function mockUpdateReturning(record: Record<string, unknown>) {
  updateSetMock.mockReturnValue({
    where: vi.fn(() => ({
      returning: vi.fn(async () => [record]),
    })),
  });
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries: Array<{ path: string; content: Buffer }>): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf-8');
    const crc = crc32(entry.content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.content.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, entry.content);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(entry.content.length, 20);
    header.writeUInt32LE(entry.content.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);

    offset += 30 + name.length + entry.content.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const centralOffset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, ...central, end]);
}

function writeTempBoxFile(zip: Buffer): string {
  const boxFilePath = path.join(os.tmpdir(), `ccps-test-box-${uuidv4()}.box`);
  fs.writeFileSync(boxFilePath, zip);
  return boxFilePath;
}

const VALID_METADATA_YAML = [
  "chip_standards_version: '1.0.0'",
  "box_id: 'b1C2d3E4f5'",
  'name: 旅行箱',
  "created_at: '2026-08-01T00:00:00.000Z'",
  "modified_at: '2026-08-01T00:00:00.000Z'",
  'active_layout_type: chips.layout.grid',
  "cover_ratio: '3:4'",
].join('\n');

const VALID_STRUCTURE_YAML = [
  'entries:',
  "  - entry_id: 'e1A2b3C4d5'",
  "    url: 'cards/day-01.card'",
  '    enabled: true',
  '    snapshot:',
  "      document_id: 'c1C2d3E4f5'",
  '      title: 第一天',
].join('\n');

const VALID_CONTENT_YAML = [
  'active_layout_type: chips.layout.grid',
  'layout_configs: {}',
].join('\n');

function createValidBoxZip(): Buffer {
  return createStoredZip([
    { path: '.box/metadata.yaml', content: Buffer.from(VALID_METADATA_YAML, 'utf-8') },
    { path: '.box/structure.yaml', content: Buffer.from(VALID_STRUCTURE_YAML, 'utf-8') },
    { path: '.box/content.yaml', content: Buffer.from(VALID_CONTENT_YAML, 'utf-8') },
    { path: '.box/cover.html', content: Buffer.from('<html><body>cover</body></html>', 'utf-8') },
  ]);
}

beforeEach(() => {
  findFirstResult = null;
  cardsFindManyResult = [];
  insertedBoxResult = null;
  updatedBoxResult = null;
});

afterEach(() => {
  findFirstResult = null;
  cardsFindManyResult = [];
  insertedBoxResult = null;
  updatedBoxResult = null;
  vi.clearAllMocks();
});

describe('BoxService unpack', () => {
  it('parses the formal box format (box_id/entries/content) and required .box files', async () => {
    const { BoxService } = await import('./box.service');
    const boxFilePath = writeTempBoxFile(createValidBoxZip());
    let tempDir: string | null = null;
    try {
      const result = await BoxService.unpack(boxFilePath);
      tempDir = result.tempDir;
      expect(result.metadata).toMatchObject({
        box_id: 'b1C2d3E4f5',
        name: '旅行箱',
        active_layout_type: 'chips.layout.grid',
        cover_ratio: '3:4',
      });
      expect(result.structure.entries).toHaveLength(1);
      expect(result.structure.entries[0]).toMatchObject({
        entry_id: 'e1A2b3C4d5',
        url: 'cards/day-01.card',
        enabled: true,
        snapshot: { document_id: 'c1C2d3E4f5', title: '第一天' },
      });
      expect(result.content).toMatchObject({ active_layout_type: 'chips.layout.grid' });
    } finally {
      fs.rmSync(boxFilePath, { force: true });
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  it('rejects archives missing content.yaml among the four required files', async () => {
    const { BoxService } = await import('./box.service');
    const zip = createStoredZip([
      { path: '.box/metadata.yaml', content: Buffer.from(VALID_METADATA_YAML, 'utf-8') },
      { path: '.box/structure.yaml', content: Buffer.from(VALID_STRUCTURE_YAML, 'utf-8') },
      { path: '.box/cover.html', content: Buffer.from('<html></html>', 'utf-8') },
    ]);
    const boxFilePath = writeTempBoxFile(zip);
    try {
      await expect(BoxService.unpack(boxFilePath)).rejects.toMatchObject({
        code: 'FILE_CORRUPT',
        message: expect.stringContaining('.box/content.yaml'),
      });
    } finally {
      fs.rmSync(boxFilePath, { force: true });
    }
  });

  it('rejects archives whose metadata misses formal required fields', async () => {
    const { BoxService } = await import('./box.service');
    const zip = createStoredZip([
      { path: '.box/metadata.yaml', content: Buffer.from("chip_standards_version: '1.0.0'\nbox_id: 'b1C2d3E4f5'\nname: 旅行箱\n", 'utf-8') },
      { path: '.box/structure.yaml', content: Buffer.from(VALID_STRUCTURE_YAML, 'utf-8') },
      { path: '.box/content.yaml', content: Buffer.from(VALID_CONTENT_YAML, 'utf-8') },
      { path: '.box/cover.html', content: Buffer.from('<html></html>', 'utf-8') },
    ]);
    const boxFilePath = writeTempBoxFile(zip);
    try {
      await expect(BoxService.unpack(boxFilePath)).rejects.toMatchObject({
        code: 'FILE_CORRUPT',
        message: expect.stringContaining('active_layout_type'),
      });
    } finally {
      fs.rmSync(boxFilePath, { force: true });
    }
  });
});

describe('BoxService create', () => {
  it('persists derived fields and source box object info', async () => {
    const { BoxService } = await import('./box.service');
    const inserted = {
      id: 'box-1',
      userId: 'user-1',
      title: '旅行箱',
      documentUrl: '/api/v1/boxes/box-1/view',
    };
    mockInsertReturning(inserted);

    const box = await BoxService.create({
      userId: 'user-1',
      visibility: 'public',
      fileSizeBytes: 2048,
      sourceBoxBucket: 'chips-box-files',
      sourceBoxKey: 'boxes/user-1/uploads/uuid/box.box',
      sourceBoxSha256: 'a'.repeat(64),
      metadata: {
        chip_standards_version: '1.0.0',
        box_id: 'b1C2d3E4f5',
        name: '旅行箱',
        created_at: '2026-08-01T00:00:00.000Z',
        modified_at: '2026-08-01T00:00:00.000Z',
        active_layout_type: 'chips.layout.grid',
        cover_ratio: '3:4',
      },
      structure: { entries: [] },
      content: { active_layout_type: 'chips.layout.grid', layout_configs: {} },
    });

    expect(box.id).toBe('box-1');
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        boxFileId: 'b1C2d3E4f5',
        title: '旅行箱',
        layoutPlugin: 'chips.layout.grid',
        coverRatio: '3:4',
        documentUrl: expect.stringMatching(/^\/api\/v1\/boxes\/[\w-]+\/view$/),
        metadata: expect.objectContaining({ box_id: 'b1C2d3E4f5' }),
        structure: { entries: [] },
        content: { active_layout_type: 'chips.layout.grid', layout_configs: {} },
        visibility: 'public',
        fileSizeBytes: 2048,
        sourceBoxBucket: 'chips-box-files',
        sourceBoxKey: 'boxes/user-1/uploads/uuid/box.box',
        sourceBoxSha256: 'a'.repeat(64),
        sourceBoxStoredAt: expect.any(Date),
      }),
    );
  });

  it('rejects metadata missing formal required fields before persisting', async () => {
    const { BoxService } = await import('./box.service');
    await expect(
      BoxService.create({
        userId: 'user-1',
        visibility: 'public',
        fileSizeBytes: 1,
        metadata: { box_id: 'b1C2d3E4f5', name: '旅行箱' },
        structure: { entries: [] },
        content: {},
      }),
    ).rejects.toMatchObject({ code: 'FILE_CORRUPT' });
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it('updates the placeholder record when boxId is provided', async () => {
    const { BoxService } = await import('./box.service');
    mockUpdateReturning({
      id: 'box-1',
      userId: 'user-1',
      title: '旅行箱',
    });

    const box = await BoxService.create({
      userId: 'user-1',
      visibility: 'public',
      fileSizeBytes: 2048,
      sourceBoxBucket: 'chips-box-files',
      sourceBoxKey: 'boxes/box-1/versions/ver-1/box.box',
      metadata: {
        box_id: 'b1C2d3E4f5',
        name: '旅行箱',
        active_layout_type: 'chips.layout.grid',
      },
      structure: { entries: [] },
      content: {},
      boxId: 'box-1',
    });

    expect(box.id).toBe('box-1');
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        boxFileId: 'b1C2d3E4f5',
        title: '旅行箱',
        layoutPlugin: 'chips.layout.grid',
        sourceBoxKey: 'boxes/box-1/versions/ver-1/box.box',
      }),
    );
  });

  it('creates placeholder records for upload sessions', async () => {
    const { BoxService } = await import('./box.service');
    mockInsertReturning({ id: 'box-1', title: '旅行箱' });

    const box = await BoxService.createPlaceholder({
      userId: 'user-1',
      title: '旅行箱',
      roomId: 'room-1',
      visibility: 'private',
      publishedByClient: 'chips-box-transfer',
    });

    expect(box.id).toBe('box-1');
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        roomId: 'room-1',
        title: '旅行箱',
        visibility: 'private',
        fileSizeBytes: 0,
      }),
    );
  });
});

describe('BoxService enrichCardRefs', () => {
  it('matches entries by snapshot.document_id and derives embedded from url shape', async () => {
    const { BoxService } = await import('./box.service');
    cardsFindManyResult = [
      { id: 'card-uuid-1', cardFileId: 'c1C2d3E4f5', status: 'ready', visibility: 'public' },
    ];

    const enriched = await BoxService.enrichCardRefs({
      entries: [
        {
          entry_id: 'e1',
          url: 'https://example.com/day-01.card',
          enabled: true,
          snapshot: { document_id: 'c1C2d3E4f5', title: '第一天' },
        },
        {
          entry_id: 'e2',
          url: 'cards/day-02.card',
          enabled: true,
          snapshot: { document_id: 'unknown-doc-id', title: '第二天' },
        },
        {
          entry_id: 'e3',
          url: 'file:///Users/name/Cards/day-03.card',
          enabled: true,
        },
      ],
    });

    expect(enriched).toEqual([
      expect.objectContaining({
        entry_id: 'e1',
        url: 'https://example.com/day-01.card',
        document_id: 'c1C2d3E4f5',
        title: '第一天',
        embedded: false,
        communityCardId: 'card-uuid-1',
        communityViewUrl: '/api/v1/cards/card-uuid-1/view',
        communityRenderStatusUrl: '/api/v1/cards/card-uuid-1/render-status',
      }),
      expect.objectContaining({
        entry_id: 'e2',
        url: 'cards/day-02.card',
        embedded: true,
        communityCardId: undefined,
      }),
      expect.objectContaining({
        entry_id: 'e3',
        url: 'file:///Users/name/Cards/day-03.card',
        embedded: false,
      }),
    ]);
  });

  it('only queries cards that are ready and public', async () => {
    const { BoxService } = await import('./box.service');
    const { db } = await import('../db/client');
    cardsFindManyResult = [];

    const enriched = await BoxService.enrichCardRefs({
      entries: [
        { entry_id: 'e1', url: 'https://example.com/x.card', enabled: true, snapshot: { document_id: 'c1C2d3E4f5' } },
      ],
    });

    expect(enriched[0]?.communityCardId).toBeUndefined();
    expect(db.query.cards.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: 'and',
          conditions: expect.arrayContaining([
            expect.objectContaining({ op: 'inArray', values: ['c1C2d3E4f5'] }),
            expect.objectContaining({ op: 'eq', right: 'ready' }),
            expect.objectContaining({ op: 'eq', right: 'public' }),
          ]),
        }),
      }),
    );
  });
});

describe('BoxService delete', () => {
  it('removes the source box object before deleting the record', async () => {
    const { BoxService } = await import('./box.service');
    findFirstResult = {
      id: 'box-1',
      userId: 'user-1',
      visibility: 'public',
      sourceBoxBucket: 'chips-box-files',
      sourceBoxKey: 'boxes/user-1/uploads/uuid/box.box',
    };
    deleteWhereMock.mockResolvedValue(undefined);

    await BoxService.delete('box-1', 'user-1');

    expect(deleteObjectMock).toHaveBeenCalledWith(
      'chips-box-files',
      'boxes/user-1/uploads/uuid/box.box',
    );
    expect(deleteWhereMock).toHaveBeenCalled();
  });

  it('does not touch storage when the box has no source object', async () => {
    const { BoxService } = await import('./box.service');
    findFirstResult = { id: 'box-1', userId: 'user-1', visibility: 'public' };
    deleteWhereMock.mockResolvedValue(undefined);

    await BoxService.delete('box-1', 'user-1');

    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});
