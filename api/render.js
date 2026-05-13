import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.AWS_REGION ?? 'eu-west-2';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME;
const SITE_URL = process.env.REMOTION_SITE_URL;
const PRESIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const s3 = new S3Client({ region: REGION });

async function waitForRender(renderId, bucketName) {
  while (true) {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: FUNCTION_NAME,
      region: REGION,
    });
    if (progress.done) return progress.outputFile; // s3://{bucket}/{key}
    if (progress.fatalErrorEncountered) throw new Error(progress.errors[0]?.message ?? 'Render failed');
    await new Promise(r => setTimeout(r, 3000));
  }
}

function parseS3Url(s3Url) {
  // Handles both s3://bucket/key and https://bucket.s3.region.amazonaws.com/key
  if (s3Url.startsWith('s3://')) {
    const withoutScheme = s3Url.slice(5);
    const slash = withoutScheme.indexOf('/');
    return { bucket: withoutScheme.slice(0, slash), key: withoutScheme.slice(slash + 1) };
  }
  const url = new URL(s3Url);
  const bucket = url.hostname.split('.')[0];
  const key = url.pathname.slice(1);
  return { bucket, key };
}

export async function handler(event) {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  const { campaignId, client, variants } = body;

  // Render sequentially to avoid Lambda concurrency limits during testing
  const renders = [];
  for (const variant of variants) {
    const outName = `${client.slug}/${campaignId}/${variant.id}.mp4`;

    const { renderId, bucketName } = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION_NAME,
      serveUrl: SITE_URL,
      composition: variant.compositionId,
      inputProps: {
        headline: [variant.headline1, variant.headline2],
        body: variant.body,
        image: variant.imageUrl,
        qrUrl: variant.qrUrl || client.defaultQrUrl,
        qrCta: variant.qrCta,
        footerTag: client.footerTag,
        venue: client.venue,
      },
      codec: 'h264',
      outName,
    });

    const outputFile = await waitForRender(renderId, bucketName);
    const { bucket, key } = parseS3Url(outputFile);
    const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000);

    const presignedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: PRESIGNED_URL_TTL_SECONDS }
    );

    renders.push({
      variantId: variant.id,
      s3Key: `${bucket}/${key}`,
      presignedUrl,
      expiresAt: expiresAt.toISOString(),
    });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, renders }),
  };
}
