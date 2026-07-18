#!/usr/bin/env bash
#
# NEXUS — Cloud Run deploy.
#
# Idempotent: safe to re-run. It provisions what is missing (Artifact Registry
# repo, the Gemini secret), builds and deploys through Cloud Build passing the
# NEXT_PUBLIC_FIREBASE_* values as *build args* (they are inlined into the client
# bundle at build time — a runtime env var is too late), then grants the Cloud
# Run service account the two roles it needs and prints the live URL.
#
# Prerequisites (see README §Deploy):
#   - gcloud authenticated, billing-enabled project selected
#   - .env.local populated with the six NEXT_PUBLIC_FIREBASE_* values + GEMINI_API_KEY
#
# Usage:  ./scripts/deploy.sh
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-nexus}"
REPO="${REPO:-nexus}"
SECRET="${SECRET:-gemini-api-key}"

PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "ERROR: no active gcloud project. Run: gcloud config set project <ID>" >&2
  exit 1
fi

# ── Load .env.local (the NEXT_PUBLIC_* build args + GEMINI_API_KEY) ────────────
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
else
  echo "WARN: no .env.local found; deploying without Firebase/Gemini config." >&2
fi

echo "▶ Project ${PROJECT_ID} · region ${REGION} · service ${SERVICE}"

# ── 1. Enable the APIs (no-op if already on) ──────────────────────────────────
echo "▶ Enabling required APIs…"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  --project "${PROJECT_ID}"

# ── 2. Artifact Registry repo (create if missing) ─────────────────────────────
if ! gcloud artifacts repositories describe "${REPO}" \
  --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "▶ Creating Artifact Registry repo '${REPO}'…"
  gcloud artifacts repositories create "${REPO}" \
    --repository-format docker --location "${REGION}" \
    --description "NEXUS container images" --project "${PROJECT_ID}"
fi

# ── 3. Gemini secret (create or add a new version) ────────────────────────────
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  if gcloud secrets describe "${SECRET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "▶ Adding a new version to secret '${SECRET}'…"
    printf '%s' "${GEMINI_API_KEY}" | gcloud secrets versions add "${SECRET}" \
      --data-file=- --project "${PROJECT_ID}"
  else
    echo "▶ Creating secret '${SECRET}'…"
    printf '%s' "${GEMINI_API_KEY}" | gcloud secrets create "${SECRET}" \
      --data-file=- --replication-policy automatic --project "${PROJECT_ID}"
  fi
else
  echo "WARN: GEMINI_API_KEY not set; AI features will run in rule-based mode." >&2
fi

# ── 4. Build + deploy via Cloud Build (bakes NEXT_PUBLIC_* as build args) ──────
echo "▶ Submitting Cloud Build (build → push → deploy)…"
gcloud builds submit \
  --project "${PROJECT_ID}" \
  --config cloudbuild.yaml \
  --substitutions "\
_REGION=${REGION},\
_SERVICE=${SERVICE},\
_REPO=${REPO},\
_NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY:-},\
_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-},\
_NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-},\
_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-},\
_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-},\
_NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID:-}"

# ── 5. Least-privilege IAM for the Cloud Run runtime service account ───────────
# Cloud Run uses the default compute SA unless told otherwise. It needs exactly
# two things: read the Gemini secret, and read/write Firestore. Nothing more.
RUNTIME_SA="$(gcloud run services describe "${SERVICE}" \
  --region "${REGION}" --project "${PROJECT_ID}" \
  --format 'value(spec.template.spec.serviceAccountName)')"
if [[ -z "${RUNTIME_SA}" ]]; then
  PROJECT_NUM="$(gcloud projects describe "${PROJECT_ID}" --format 'value(projectNumber)')"
  RUNTIME_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
fi
echo "▶ Granting least-privilege roles to ${RUNTIME_SA}…"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/datastore.user --condition None >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/secretmanager.secretAccessor --condition None >/dev/null

# ── 6. Firestore security rules ───────────────────────────────────────────────
# The rules deny all client access (the Admin SDK is the only reader). Deploy
# them with the Firebase CLI if it is installed; otherwise print the reminder.
if command -v firebase >/dev/null 2>&1; then
  echo "▶ Deploying Firestore security rules…"
  firebase deploy --only firestore:rules --project "${PROJECT_ID}" || \
    echo "WARN: 'firebase deploy' failed; deploy firestore.rules manually." >&2
else
  echo "NOTE: Firebase CLI not found — deploy firestore.rules from the console or:"
  echo "      npx firebase-tools deploy --only firestore:rules --project ${PROJECT_ID}"
fi

# ── 7. Done — print the URL and the one manual step that remains ──────────────
URL="$(gcloud run services describe "${SERVICE}" \
  --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')"
cat <<EOF

✅ Deployed: ${URL}

ONE MANUAL STEP (Google sign-in fails without it):
  Firebase console → Authentication → Settings → Authorized domains → Add domain
  Add the Cloud Run host:  ${URL#https://}

Then open ${URL} and run the demo arc.
EOF
