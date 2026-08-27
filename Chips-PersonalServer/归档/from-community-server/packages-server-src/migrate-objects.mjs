import { S3Client, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

const SOURCE_BUCKET = 'ccps';
const PREFIX = 'chips-card-resources/';

const list = await s3.send(new ListObjectsV2Command({ Bucket: SOURCE_BUCKET, Prefix: PREFIX, MaxKeys: 500 }));
const objects = (list.Contents || []).map(o => o.Key);
console.log(`ccps 桶待迁移对象: ${objects.length}`);
for (const key of objects) {
  const targetBucket = key.split('/')[0];
  const targetKey = key.slice(targetBucket.length + 1);
  await s3.send(new CopyObjectCommand({
    Bucket: targetBucket,
    Key: targetKey,
    CopySource: `/${SOURCE_BUCKET}/${key}`,
  }));
  await s3.send(new DeleteObjectCommand({ Bucket: SOURCE_BUCKET, Key: key }));
  console.log(`迁移: ${key} -> ${targetBucket}/${targetKey}`);
}
console.log('迁移完成');
