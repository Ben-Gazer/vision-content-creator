# Vision Content Creator

Agency-scale pipeline for generating animated MP4 display ads from a composable cloud stack. Each client's brand assets and campaign content live in a CMS; workflow orchestration triggers cloud rendering on demand; rendered MP4s land in S3 for approval and scheduling.

## Stack

| Layer | Tool |
|-------|------|
| Content & assets | [Directus](https://directus.io) (Railway) |
| Workflow orchestration | [Make.com](https://make.com) |
| Cloud rendering | [Remotion Lambda](https://remotion.dev/lambda) |
| Asset storage | AWS S3 |
| Digital signage delivery | [NowSignage](https://nowsignage.com) |
| Compositions | React + [Remotion](https://remotion.dev) |

## Architecture

```
Directus (Railway)
  ┌──────────────────────────────────────────────────────────┐
  │  clients  │  campaigns  │  variants  │  renders           │
  └──────────────────────────────────────────────────────────┘
       │  webhook (status changes)
       ▼
  Make.com
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Scenario A — Render                                                 │
  │  Trigger: campaign.status = ready_to_render                          │
  │  1. Fetch variants + Directus CDN image URLs                         │
  │  2. POST to Render API → Remotion Lambda renders in parallel         │
  │  3. Write S3 keys + presigned URLs to renders collection             │
  │  4. Set campaign.status = rendered                                    │
  │  5. Send approval notification (presigned URLs for preview)           │
  ├─────────────────────────────────────────────────────────────────────┤
  │  Scenario B — Publish to NowSignage                                  │
  │  Trigger: campaign.status = approved                                  │
  │  1. Fetch render records (presigned URLs) for campaign               │
  │  2. For each render: GET MP4 from S3 → POST to NowSignage media lib  │
  │  3. Write nowsignage_asset_id back to renders collection             │
  │  4. Set campaign.status = published                                   │
  └─────────────────────────────────────────────────────────────────────┘
       │ Scenario A                         │ Scenario B
       ▼                                    ▼
  Render API (AWS Lambda)            NowSignage Media Library
       │                             POST /profiles/{id}/assets/videos
       ▼
  Remotion Lambda
  (renderMediaOnLambda per variant)
       │
       ▼
  S3 Bucket (MP4s + presigned URLs)
```

### Campaign lifecycle

```
draft → ready_to_render → rendering → rendered → approved → published
                               ↑ Scenario A          ↑ Scenario B
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
| nowsignage_asset_id | string | written by Scenario B after upload |

## Make.com Scenarios

### Scenario A — Render

**Trigger:** Directus webhook → `campaigns.status` updated to `ready_to_render`

1. `GET /items/campaigns/{id}?fields=*,client.*,variants.*,variants.image.*`
2. Map variants: construct Directus CDN URL from `image.id` → `{DIRECTUS_URL}/assets/{image.id}`
3. `POST` to Render API with campaign + variant payload
4. `PATCH /items/campaigns/{id}` → status: `rendering`
5. On response: `POST /items/renders` per variant with S3 key + presigned URL
6. `PATCH /items/campaigns/{id}` → status: `rendered`
7. Send approval notification (Slack / email) with presigned URLs for preview

### Scenario B — Publish to NowSignage

**Trigger:** Directus webhook → `campaigns.status` updated to `approved`

1. `GET /items/renders?filter[variant][campaign][_eq]={campaignId}&fields=*`  
   Fetch all render records for the campaign
2. For each render:
   - `GET {presigned_url}` — download MP4 binary from S3
   - `POST https://api.nowsignage.com/v1/profiles/{NOWSIGNAGE_PROFILE_ID}/assets/videos`  
     Multipart upload with bearer token auth; receive `asset.id` in response
   - `PATCH /items/renders/{id}` → `nowsignage_asset_id: asset.id`
3. `PATCH /items/campaigns/{id}` → status: `published`
4. Send confirmation notification with NowSignage asset IDs

**NowSignage auth header:**
```
Authorization: Bearer {NOWSIGNAGE_API_TOKEN}
```

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
- A NowSignage API token and profile ID (Settings → API in the NowSignage dashboard)

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

### 4. NowSignage

1. Log into your NowSignage account
2. Go to **Settings → API** and generate an API token
3. Note your profile ID from the URL (`/profiles/{id}/`)
4. Add both to `.env` as `NOWSIGNAGE_API_TOKEN` and `NOWSIGNAGE_PROFILE_ID`

### 5. Make.com

Build both scenarios described above:
- **Scenario A** — Render API endpoint is your deployed `api/render.js` Lambda function URL
- **Scenario B** — Uses NowSignage API directly; no Lambda involved

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
