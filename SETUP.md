# Deployment Setup Guide

## Architecture

```
Cloudflare DNS + Proxy
  │
  ├── yourdomain.com       →  Cloud Run: chat-room-frontend  (Next.js 14 SSR)
  └── api.yourdomain.com   →  Cloud Run: chat-room-backend   (NestJS + Socket.io)
                                              │
                                         GCS bucket (SQLite DB file)
```

---

## Step 1 — Enable GCP APIs (run once)

```bash
export PROJECT_ID=<project_id>
gcloud config set project $PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com
```

---

## Step 2 — Create the Artifact Registry repository (run once)

Images are stored in Artifact Registry (GCR is legacy and no longer recommended).

```bash
gcloud artifacts repositories create chat-room \
  --repository-format=docker \
  --location=asia-southeast1 \
  --project=$PROJECT_ID
```

Your image URLs will follow this pattern:
```
asia-southeast1-docker.pkg.dev/$PROJECT_ID/chat-room/chat-room-frontend
asia-southeast1-docker.pkg.dev/$PROJECT_ID/chat-room/chat-room-backend
```

---

## Step 3 — Create the SQLite storage bucket

Cloud Run is stateless, so the SQLite DB file lives in a GCS bucket mounted
as a volume at `/mnt/data` inside the backend container.

```bash
gcloud storage buckets create gs://$PROJECT_ID-chat-db \
  --project=$PROJECT_ID \
  --location=US-CENTRAL1 \
  --uniform-bucket-level-access
```

> **Important**: The bucket must be in the same region as the Cloud Run service (`us-central1`).
> Cross-region GCS volume mounts cause SQLite I/O errors.

---

## Step 4 — Grant the Cloud Run runtime service account access to the bucket

Cloud Run uses the default Compute service account at runtime. It needs explicit
permission to read/write the GCS bucket.

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud storage buckets add-iam-policy-binding gs://$PROJECT_ID-chat-db \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

---

## Step 5 — Store secrets in Secret Manager

```bash
# JWT signing secret — use a long random string
echo -n "your-strong-jwt-secret" | \
  gcloud secrets create chat-room-jwt-secret \
  --data-file=- --project=$PROJECT_ID

# Admin password
echo -n "your-admin-password" | \
  gcloud secrets create chat-room-admin-password \
  --data-file=- --project=$PROJECT_ID

# reCAPTCHA secret key (leave as empty string if not using)
echo -n "your-recaptcha-secret" | \
  gcloud secrets create chat-room-recaptcha-secret \
  --data-file=- --project=$PROJECT_ID
```

---

## Step 6 — Set up Workload Identity Federation (keyless — no JSON keys)

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
POOL=github-pool
PROVIDER=github-provider
SA=github-deployer

# Workload Identity Pool
gcloud iam workload-identity-pools create $POOL \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"

# OIDC Provider
# NOTE: --attribute-condition is required — keeps the pool locked to your repo only
gcloud iam workload-identity-pools providers create-oidc $PROVIDER \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=$POOL \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-condition="assertion.repository == 'my-javascript-playground/chat-room'"

# Service Account
gcloud iam service-accounts create $SA \
  --project=$PROJECT_ID \
  --display-name="GitHub Deployer"

# Grant roles to the SA
for ROLE in roles/run.admin roles/storage.admin roles/iam.serviceAccountUser roles/secretmanager.secretAccessor roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="$ROLE"
done

# Allow this GitHub repo to impersonate the SA
gcloud iam service-accounts add-iam-policy-binding \
  $SA@$PROJECT_ID.iam.gserviceaccount.com \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/my-javascript-playground/chat-room"

# Print values needed for GitHub Secrets
echo ""
echo "=== Add these as GitHub Secrets ==="
echo "GCP_WORKLOAD_IDENTITY_PROVIDER:"
echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"
echo ""
echo "GCP_SERVICE_ACCOUNT:"
echo "$SA@$PROJECT_ID.iam.gserviceaccount.com"
```

---

## Step 7 — GitHub Secrets to add

Go to: your repo → Settings → Secrets and variables → Actions → New repository secret

| Secret | Value |
|--------|-------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Output from Step 6 |
| `GCP_SERVICE_ACCOUNT` | Output from Step 6 |
| `DOMAIN_NAME` | e.g. `chat.yourdomain.com` |
| `BACKEND_URL` | Cloud Run backend URL (fill after first backend deploy) |
| `RECAPTCHA_SITE_KEY` | Your reCAPTCHA v2 site key (or leave empty) |

---

## Step 8 — Files to add/update in your repo

```
chat-room/
├── .github/workflows/
│   ├── deploy-backend.yml      ← new
│   └── deploy-frontend.yml     ← new
├── backend/
│   └── Dockerfile              ← new
└── frontend/
    ├── Dockerfile              ← new
    └── next.config.js          ← updated (add output: "standalone")
```

### deploy-frontend.yml (relevant section)

```yaml
env:
  PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
  REGION: us-central1
  SERVICE: chat-room-frontend
  IMAGE: asia-southeast1-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/chat-room/chat-room-frontend

# In the Configure Docker step:
- name: Configure Docker for Artifact Registry
  run: gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet

# Cloud Run flags:
flags: >-
  --allow-unauthenticated
  --min-instances=0
  --max-instances=1
  --memory=256Mi
  --cpu=1
  --port=3000
  --timeout=60s
  --concurrency=80
```

### deploy-backend.yml (relevant section)

```yaml
env:
  PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
  REGION: us-central1
  SERVICE: chat-room-backend
  IMAGE: asia-southeast1-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/chat-room/chat-room-backend

# In the Configure Docker step:
- name: Configure Docker for Artifact Registry
  run: gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet

# Cloud Run flags:
flags: >-
  --allow-unauthenticated
  --min-instances=0
  --max-instances=1
  --memory=512Mi
  --cpu=1
  --port=8080
  --timeout=60s
  --concurrency=80
  --execution-environment=gen2
  --add-volume=name=sqlite-data,type=cloud-storage,bucket=${{ vars.GCP_PROJECT_ID }}-chat-db
  --add-volume-mount=volume=sqlite-data,mount-path=/mnt/data
```

> **Notes on backend flags**:
> - `--memory=512Mi` minimum is required when using `--execution-environment=gen2`
> - `--execution-environment=gen2` is required for GCS volume mounts to work
> - Do not set `PORT` in `env_vars` — Cloud Run sets it automatically from `--port`

---

## Step 9 — First deploy order

1. **Commit all files** and push to `main`
2. Backend workflow runs first — copy the printed Cloud Run URL
3. Go to GitHub Secrets → update `BACKEND_URL` with that URL
4. Re-run the frontend workflow (or push a trivial frontend change)

---

## Step 10 — Custom domain + Cloudflare

### Backend (api subdomain)
1. Cloud Run console → `chat-room-backend` → Custom domains → Add mapping
2. Enter `api.yourdomain.com` → Cloud Run gives you a CNAME value
3. In Cloudflare DNS: add that CNAME record as **Proxied** (orange cloud)

### Frontend (apex / subdomain)
1. Cloud Run console → `chat-room-frontend` → Custom domains → Add mapping
2. Enter `yourdomain.com` → Cloud Run gives you A records
3. In Cloudflare DNS: add those A records as **Proxied** (orange cloud)

### Cloudflare SSL
- SSL/TLS mode → **Full (strict)**
- Edge Certificates → **Always Use HTTPS**: ON

### CORS
Your backend `main.ts` already reads `FRONTEND_URL` from env — that's set in
the workflow to `https://${{ secrets.DOMAIN_NAME }}`, so CORS is handled.

### WebSocket (Socket.io)
Cloudflare proxies WebSocket connections automatically on the standard HTTPS
port (443) when the orange cloud is active. No extra config needed.

---

## Notes

**SQLite + Cloud Run**: The GCS volume mount gives the SQLite file persistence
across deployments and container restarts. However, Cloud Run can run multiple
instances — SQLite doesn't support concurrent writes from multiple processes.
Keep `--max-instances=1` on the backend to avoid write conflicts, or migrate
to Cloud SQL (PostgreSQL) when you need to scale.

**Scaling to zero**: Both services have `--min-instances=0` so they cost nothing
when idle. Cold starts are ~2–4s for NestJS. Increase to `--min-instances=1` if
you need instant response.

**Cloud Run region vs Artifact Registry region**: Cloud Run runs in `us-central1`
(cheapest, most generous free tier). The Artifact Registry stays in `asia-southeast1`
— Cloud Run can pull images across regions without issues.

**Artifact Registry vs GCR**: The old `gcr.io` hostname (Google Container Registry)
is legacy. Artifact Registry (`*.pkg.dev`) is the current standard and requires
the `roles/artifactregistry.writer` role on the service account.

**Multi-line gcloud commands**: When splitting a `gcloud` command across lines
with `\`, every line except the last must end with ` \` — including the line
before `--attribute-condition`. Missing a backslash causes the shell to submit
the command early and treat the next line as a separate command.