import { unpackCard } from './pipeline/card-unpack';
import * as path from 'path';

async function run() {
  const file = path.resolve('../../../ProductFinishedProductTestingSpace/薯片生态介绍.card');
  try {
    const result = await unpackCard(file);
    console.log('Unpack success:', result.metadata);
    console.log('Structure:', JSON.stringify(result.structure, null, 2));
  } catch (err) {
    console.error('Unpack failed:', err);
  }
}

run();
