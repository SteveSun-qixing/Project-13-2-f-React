import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve('/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-CommunityPlatformServer/deploy/.env') });

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://127.0.0.1:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const prefix = process.argv[2] || '';
for (const bucket of ['ccps', 'chips-card-resources', 'chips-card-cover-cache']) {
  const cmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 100 });
  try {
    const r = await s3.send(cmd);
    const keys = (r.Contents || []).map(o => o.Key);
    console.log(`== ${bucket} (prefix=${prefix}) 对象数: ${keys.length}`);
    for (const k of keys.slice(0, 8)) console.log('  ', k);
  } catch (e) {
    console.log(`== ${bucket} 错误:`, e.message || e);
  }
}
