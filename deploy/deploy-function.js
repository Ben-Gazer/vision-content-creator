import { deployFunction, getOrCreateBucket } from '@remotion/lambda';
import { REMOTION_REGION } from './config.js';

await getOrCreateBucket({ region: REMOTION_REGION });

const { functionName, alreadyExisted } = await deployFunction({
  region: REMOTION_REGION,
  timeoutInSeconds: 240,
  memorySizeInMb: 2048,
  createCloudWatchLogGroup: true,
});

console.log(`Function ${alreadyExisted ? 'updated' : 'deployed'}:`);
console.log(`  REMOTION_FUNCTION_NAME=${functionName}`);
