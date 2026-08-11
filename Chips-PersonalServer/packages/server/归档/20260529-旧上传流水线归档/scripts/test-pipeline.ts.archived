import { runCardPipeline } from './pipeline/card-pipeline';
import * as path from 'path';

async function run() {
  const file = path.resolve('../../../ProductFinishedProductTestingSpace/薯片生态介绍.card');
  try {
    const dummyCardId = '00000000-0000-0000-0000-000000000000';
    const dummyUserId = '00000000-0000-0000-0000-000000000000';

    await runCardPipeline({
      cardFilePath: file,
      cardDbId: dummyCardId,
      userId: dummyUserId,
    });
  } catch (err) {
    console.error('Pipeline failed entirely:', err);
  }
}

run();
