import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.AWS_REGION ?? 'eu-west-2';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME;
const SITE_URL = process.env.REMOTION_SITE_URL;
const S3_BUCKET = process.env.S3_BUCKET;
const PRESIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const s3 = new S3Client({ region: REGION });

async function waitForRender(renderId, bucketName) {
  while (true) {
    const progress = await getRenderProgress({ renderId, bucketName, functionName: FUNCTION_NAME, region: REGION });
    if (progress.done) return progress.outputFile;
    if (progress.fatalErrorEncountered) throw new Error(progress.errors[0]?.message ?? 'Render failed');
    await new Promise(r => setTimeout(r, 3000));
  }
}

export async function handler(event) {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  const { campaignId, client, variants } = body;

  const renders = await Promise.all(
    variants.map(async (variant) => {
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

      await waitForRender(renderId, bucketName);

      const s3Key = `renders/${outName}`;
      const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000);

      const presignedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }),
        { expiresIn: PRESIGNED_URL_TTL_SECONDS }
      );

      return { variantId: variant.id, s3Key, presignedUrl, expiresAt: expiresAt.toISOString() };
    })
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, renders }),
  };
}
