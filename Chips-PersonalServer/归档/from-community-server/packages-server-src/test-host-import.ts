import { HeadlessHostShell } from 'chips-host/headless-host-shell';
import * as path from 'path';

async function test() {
  console.log('HeadlessHostShell imported');
  const host = new HeadlessHostShell({
    workspacePath: path.resolve('./.test-host-workspace')
  });
  void host;
  console.log('HeadlessHostShell instance created');
}

test().catch(console.error);
