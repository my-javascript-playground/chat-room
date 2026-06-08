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
gcloud config set project <project_id>

gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com
```

---

## Step 2 — Create the SQLite storage bucket

Cloud Run is stateless, so the SQLite DB file lives in a GCS bucket mounted
as a volume at `/mnt/data` inside the backend container.

```bash
gcloud storage buckets create gs://<project_id>-chat-db \
  --project=<project_id> \
  --location=ASIA-SOUTHEAST1 \
  --uniform-bucket-level-access
```

---

## Step 3 — Store secrets in Secret Manager

```bash
# JWT signing secret — use a long random string
echo -n "your-strong-jwt-secret" | \
  gcloud secrets create chat-room-jwt-secret \
  --data-file=- --project=<project_id>

# Admin password
echo -n "your-admin-password" | \
  gcloud secrets create chat-room-admin-password \
  --data-file=- --project=<project_id>

# reCAPTCHA secret key (leave as empty string if not using)
echo -n "your-recaptcha-secret" | \
  gcloud secrets create chat-room-recaptcha-secret \
  --data-file=- --project=<project_id>
```

---

## Step 4 — Set up Workload Identity Federation (keyless — no JSON keys)

```bash
PROJECT_NUMBER=$(gcloud projects describe <project_id> --format='value(projectNumber)')
POOL=github-pool
PROVIDER=github-provider
SA=github-deployer

# Workload Identity Pool
gcloud iam workload-identity-pools create $POOL \
  --project=<project_id> \
  --location=global \
  --display-name="GitHub Actions Pool"

# OIDC Provider
gcloud iam workload-identity-pools providers create-oidc $PROVIDER \
  --project=<project_id> \
  --location=global \
  --workload-identity-pool=$POOL \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-condition="assertion.repository == 'my-javascript-playground/chat-room'"


# Service Account
gcloud iam service-accounts create $SA \
  --project=<project_id> \
  --display-name="GitHub Deployer"

# Grant roles to the SA
for ROLE in roles/run.admin roles/storage.admin roles/iam.serviceAccountUser roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding <project_id> \
    --member="serviceAccount:$SA@<project_id>.iam.gserviceaccount.com" \
    --role="$ROLE"
done

# Allow this GitHub repo to impersonate the SA
gcloud iam service-accounts add-iam-policy-binding \
  $SA@<project_id>.iam.gserviceaccount.com \
  --project=<project_id> \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/my-javascript-playground/chat-room"

# Print values needed for GitHub Secrets
echo ""
echo "=== Add these as GitHub Secrets ==="
echo "GCP_WORKLOAD_IDENTITY_PROVIDER:"
echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"
echo ""
echo "GCP_SERVICE_ACCOUNT:"
echo "$SA@<project_id>.iam.gserviceaccount.com"
```

---

## Step 5 — GitHub Secrets to add

Go to: your repo → Settings → Secrets and variables → Actions → New repository secret

| Secret | Value |
|--------|-------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Output from Step 4 |
| `GCP_SERVICE_ACCOUNT` | Output from Step 4 |
| `DOMAIN_NAME` | e.g. `chat.yourdomain.com` |
| `BACKEND_URL` | Cloud Run backend URL (fill after first backend deploy) |
| `RECAPTCHA_SITE_KEY` | Your reCAPTCHA v2 site key (or leave empty) |

---

## Step 6 — Files to add/update in your repo

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

---

## Step 7 — First deploy order

1. **Commit all files** and push to `main`
2. Backend workflow runs first — copy the printed Cloud Run URL
3. Go to GitHub Secrets → update `BACKEND_URL` with that URL
4. Re-run the frontend workflow (or push a trivial frontend change)

---

## Step 8 — Custom domain + Cloudflare

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
Keep `--max-instances=1` on the backend if you see write conflicts, or migrate
to Cloud SQL (PostgreSQL) when you need to scale.

**Scaling to zero**: Both services have `--min-instances=0` so they cost nothing
when idle. Cold starts are ~2–4s for NestJS. Increase to `--min-instances=1` if
you need instant response.
