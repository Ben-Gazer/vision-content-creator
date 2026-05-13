# Vision Content Creator

Agency-scale pipeline for generating animated MP4 display ads from a composable cloud stack. Each client's brand assets and campaign content live in a CMS; workflow orchestration triggers cloud rendering on demand; rendered MP4s land in S3 for approval and scheduling.

## Stack

| Layer | Tool |
|-------|------|
| Content & assets | [Directus](https://directus.io) (Railway) |
| Workflow orchestration | [Make.com](https://make.com) |
| Cloud rendering | [Remotion Lambda](https://remotion.dev/lambda) |
| Asset storage | AWS S3 |
| Compositions | React + [Remotion](https://remotion.dev) |

## Architecture

```
Directus (Railway)                Make.com Scenario
  ┌──────────────────┐             ┌───────────────────────────────────────┐
  │  clients         │             │ 1. Trigger: Directus webhook           │
  │  campaigns       │──webhook──▶ │    (campaign.status = ready_to_render) │
  │  variants        │             │ 2. Fetch variants + file URLs from CMS │
  │  renders         │             │ 3. POST to Render API                  │
  │  Files (assets)  │ ◀──update── │ 4. Write render results to CMS        │
  └──────────────────┘             │ 5. Send approval notification          │
           │                       └───────────────────────────────────────┘
   Directus CDN                               │
   (image URLs)                       Render API (AWS Lambda)
                                               │
                                      Remotion Lambda
                                      ┌────────────────────┐
                                      │ renderMediaOnLambda │
                                      │ per variant,        │
                                      │ in parallel         │
                                      └────────────────────┘
                                               │
                                          S3 Bucket
                                      (MP4s + presigned URLs)
```

## Repository Structure

```
vision-content-creator/
├── src/                        # Remotion compositions
│   ├── Root.jsx                # Registers all compositions
│   ├── AdComposition.jsx       # Animation timing + frame sequencing
│   ├── Ad.jsx                  # Ad layout component
│   ├── Frame.jsx               # Outer frame (venue header + footer)
│   ├── fonts.js                # Font loader (delayRender/continueRender)
│   └── display.css             # Ad styles
├── deploy/
│   ├── deploy-site.js          # Deploy Remotion bundle to S3
│   ├── deploy-function.js      # Deploy/update Remotion Lambda function
│   └── config.js               # Shared AWS region constant
├── api/
│   └── render.js               # Lambda handler — called by Make.com
├── assets/                     # Brand assets (logo, images)
├── fonts/                      # Self-hosted Poppins TTFs
├── .env.example                # Required environment variables
├── remotion.config.js
└── package.json
```

## Directus Data Model

### `clients`
| Field | Type | Notes |
|-------|------|-------|
| slug | string | e.g. `padel-pass` |
| name | string | |
| venue | string | e.g. `Padel Pass · Luton` |
| footer_tag | string | |
| default_qr_url | string | |
| logo | file | Directus Files relation |

### `campaigns`
| Field | Type | Notes |
|-------|------|-------|
| client | relation → clients | |
| name | string | |
| status | enum | `draft` → `ready_to_render` → `rendering` → `rendered` → `approved` |

### `variants`
| Field | Type | Notes |
|-------|------|-------|
| campaign | relation → campaigns | |
| composition_id | string | e.g. `ad-price` |
| headline_1 | string | |
| headline_2 | string | |
| body | string | |
| image | file | Directus Files relation |
| qr_cta | string | |
| qr_url | string | nullable — falls back to client `default_qr_url` |

### `renders` (written by pipeline, read-only)
| Field | Type | Notes |
|-------|------|-------|
| variant | relation → variants | |
| s3_key | string | |
| presigned_url | string | |
| expires_at | datetime | 7-day TTL |
| rendered_at | datetime | |

## Make.com Scenario

**Trigger:** Directus webhook → `campaigns.status` updated to `ready_to_render`

1. `GET /items/campaigns/{id}?fields=*,client.*,variants.*,variants.image.*`
2. Map variants: construct Directus CDN URL from `image.id` → `{DIRECTUS_URL}/assets/{image.id}`
3. `POST` to Render API with campaign + variant payload
4. `PATCH /items/campaigns/{id}` → status: `rendering`
5. On response: `POST /items/renders` per variant with S3 key + presigned URL
6. `PATCH /items/campaigns/{id}` → status: `rendered`
7. Send approval notification (Slack / email) with presigned URLs

### Render API payload

```json
{
  "campaignId": "uuid",
  "client": {
    "slug": "padel-pass",
    "venue": "Padel Pass · Luton",
    "footerTag": "Padel Plus Membership",
    "defaultQrUrl": "https://padelpass.co.uk/membership"
  },
  "variants": [
    {
      "id": "uuid",
      "compositionId": "ad-price",
      "headline1": "Play More.",
      "headline2": "Pay Less.",
      "body": "Unlock 20% off every booking...",
      "imageUrl": "https://your-directus.railway.app/assets/abc123",
      "qrCta": "Scan to join",
      "qrUrl": null
    }
  ]
}
```

## Setup

### 1. Environment variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

You will need:
- AWS credentials with permissions for Lambda, S3, and CloudWatch Logs
- A Remotion Lambda function and site URL (see step 2)
- An S3 bucket for rendered MP4 output

### 2. Deploy Remotion Lambda

Run once, or whenever compositions change:

```bash
npm run deploy:function   # creates/updates the Lambda function
npm run deploy:site       # bundles and uploads the Remotion site to S3
```

Both commands print the values you need for `.env`.

### 3. Directus (Railway)

1. Deploy Directus via the [Railway template](https://railway.app/template/directus)
2. Create the collections above (schema can be imported from `directus/schema.json` when available)
3. Upload brand assets (logos, images, fonts) via Directus Files
4. Add a Directus webhook: on `campaigns` update → POST to your Make.com webhook URL
5. Set CORS to allow requests from the Remotion Lambda region

### 4. Make.com

Build the scenario described above. The Render API endpoint is your deployed `api/render.js` Lambda function URL.

## Local Preview

```bash
npm run studio
```

Opens Remotion Studio at `http://localhost:3000` with all three compositions.

## Local Render (without Lambda)

```bash
npm run render:all        # renders all three variants to out/
```

## Compositions

| ID | Headline | Image |
|----|----------|-------|
| `ad-price` | Play More. / Pay Less. | brand-rally.jpg |
| `ad-community` | Your Courts. / Your Club. | brand-team-four.jpg |
| `ad-urgency` | Stop Waiting. / Start Playing. | brand-handshake.jpg |

All compositions: 1080 × 1920px (9:16 portrait), 30fps, 6 seconds.

## Ad Animation Sequence

| Element | Frames | Effect |
|---------|--------|--------|
| Logo | 0 → 20 | Fade + slide down |
| Headline line 1 | 15 → 40 | Fade + slide right |
| Headline line 2 | 25 → 50 | Fade + slide right (staggered) |
| Body copy | 45 → 65 | Fade |
| Photo | 0 → 180 | Ken Burns 1.05 → 1.0 |
| QR block | 140 → 158 | Spring pop + fade |
