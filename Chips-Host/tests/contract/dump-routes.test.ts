import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { HostApplication } from '../../src/main/core/host-application';

describe('dump', () => {
  it('dumps host routes', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-dump-'));
    const app = new HostApplication({ workspacePath: workspace });
    await app.start();
    const routes = app.kernel.getRouteManifest().slice().sort();
    await fs.writeFile('/tmp/host-routes.json', JSON.stringify(routes, null, 2));
    await app.stop();
    await fs.rm(workspace, { recursive: true, force: true });
    expect(routes.length).toBeGreaterThan(0);
  });
});
