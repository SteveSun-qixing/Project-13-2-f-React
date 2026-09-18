import { describe, expect, it } from 'vitest';
import { createClient } from '../src';

describe('office document api', () => {
  it('routes create/read/write/persist/close through office namespace', async () => {
    const calls: Array<{ action: string; payload: unknown }> = [];
    const client = createClient({ environment: 'browser', transport: async (action, payload) => {
      calls.push({ action, payload });
      if (action === 'office.document.create') return { document: { sessionId: 's', format: 'docx', filePath: '/w/doc.docx', fileName: 'doc.docx', documentId: 'd', mimeType: 'x', size: 0, revision: 0, status: 'clean', createdAt: '', updatedAt: '' } };
      if (action === 'office.document.read') return { document: { sessionId: 's', size: 1 }, bytes: [7] };
      if (action === 'office.document.write') return { document: { sessionId: 's', revision: 1, status: 'dirty' } };
      if (action === 'office.document.persist') return { document: { sessionId: 's', status: 'clean' } };
      return { ack: true };
    }});
    const created = await client.office.create({ format: 'docx' });
    expect(created.sessionId).toBe('s');
    expect((await client.office.read('s')).bytes).toEqual(Uint8Array.from([7]));
    await client.office.write('s', Uint8Array.from([1]));
    await client.office.persist('s');
    await client.office.close('s');
    expect(calls.map((call) => call.action)).toEqual([
      'office.document.create', 'office.document.read', 'office.document.write', 'office.document.persist', 'office.document.close',
    ]);
  });
});
