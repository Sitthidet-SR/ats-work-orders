import '../src/common/env';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { required } from '../src/common/env';
const client = new S3Client({
  endpoint: required('STORAGE_ENDPOINT'),
  region: required('STORAGE_REGION'),
  forcePathStyle: true,
  credentials: {
    accessKeyId: required('STORAGE_ACCESS_KEY'),
    secretAccessKey: required('STORAGE_SECRET_KEY'),
  },
});
async function init() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: required('STORAGE_BUCKET') }));
      console.log('Private bucket ready');
      return;
    } catch {
      try {
        await client.send(new CreateBucketCommand({ Bucket: required('STORAGE_BUCKET') }));
        console.log('Private bucket created');
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  throw new Error('Object storage unavailable');
}
init().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Storage init failed');
  process.exitCode = 1;
});
