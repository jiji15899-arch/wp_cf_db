#!/usr/bin/env bash
# =============================================================
#  CF Storage — One-Click Setup Script
#  Usage: bash setup.sh
#  Requirements: Node.js 18+, wrangler installed globally
#                (npm install -g wrangler)
# =============================================================
set -euo pipefail

WORKER_NAME="wp-cf-storage"
D1_NAME="wp_cf_db"
KV_NAME="WP_CF_KV"
TOML="wrangler.toml"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   CF Storage — Cloudflare Setup Script   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Auth check ─────────────────────────────────────
echo "▶ Step 1/6 — Checking Wrangler auth..."
wrangler whoami || { echo "❌  Run: wrangler login  first"; exit 1; }

# ── Step 2: Create D1 Database ─────────────────────────────
echo ""
echo "▶ Step 2/6 — Creating D1 database '${D1_NAME}'..."
D1_OUTPUT=$(wrangler d1 create "$D1_NAME" 2>&1)
echo "$D1_OUTPUT"
D1_ID=$(echo "$D1_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+' | head -1)
if [ -z "$D1_ID" ]; then
  # Already exists — fetch the ID
  D1_ID=$(wrangler d1 list --json 2>/dev/null | python3 -c "
import sys,json
data=json.load(sys.stdin)
[print(d['uuid']) for d in data if d['name']=='${D1_NAME}']
" | head -1)
fi
echo "   D1 ID: $D1_ID"

# ── Step 3: Create KV Namespace ────────────────────────────
echo ""
echo "▶ Step 3/6 — Creating KV namespace '${KV_NAME}'..."
KV_OUTPUT=$(wrangler kv:namespace create "$KV_NAME" 2>&1)
echo "$KV_OUTPUT"
KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id\s*=\s*"\K[^"]+' | head -1)

KV_PREVIEW_OUTPUT=$(wrangler kv:namespace create "${KV_NAME}_preview" --preview 2>&1)
KV_PREVIEW_ID=$(echo "$KV_PREVIEW_OUTPUT" | grep -oP 'id\s*=\s*"\K[^"]+' | head -1)
echo "   KV ID: $KV_ID"
echo "   KV Preview ID: $KV_PREVIEW_ID"

# ── Step 4: Patch wrangler.toml ────────────────────────────
echo ""
echo "▶ Step 4/6 — Patching ${TOML}..."
sed -i "s/REPLACE_WITH_YOUR_D1_DATABASE_ID/${D1_ID}/" "$TOML"
sed -i "s/REPLACE_WITH_YOUR_KV_ID/${KV_ID}/" "$TOML"
sed -i "s/REPLACE_WITH_YOUR_KV_PREVIEW_ID/${KV_PREVIEW_ID}/" "$TOML"
echo "   ✅ wrangler.toml updated"

# ── Step 5: Run D1 Schema ──────────────────────────────────
echo ""
echo "▶ Step 5/6 — Running D1 schema migration..."
wrangler d1 execute "$D1_NAME" --file=schema.sql
echo "   ✅ Schema applied"

# ── Step 6: Set API_KEY secret ─────────────────────────────
echo ""
echo "▶ Step 6/6 — Setting API_KEY secret..."
API_KEY=$(openssl rand -hex 32)
echo "$API_KEY" | wrangler secret put API_KEY
echo ""
echo "══════════════════════════════════════════════"
echo "   🔑  YOUR API KEY (save this!)"
echo "   $API_KEY"
echo "══════════════════════════════════════════════"

# ── Deploy ─────────────────────────────────────────────────
echo ""
read -p "▶ Deploy Worker now? [y/N] " DEPLOY
if [[ "$DEPLOY" =~ ^[Yy]$ ]]; then
  DEPLOY_OUTPUT=$(wrangler deploy 2>&1)
  echo "$DEPLOY_OUTPUT"
  WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^\s]+workers\.dev' | head -1)
  echo ""
  echo "══════════════════════════════════════════════"
  echo "   ✅  WORKER DEPLOYED"
  echo "   URL: $WORKER_URL"
  echo ""
  echo "   → WordPress Plugin Settings:"
  echo "     Worker URL : $WORKER_URL"
  echo "     API Key    : $API_KEY"
  echo "══════════════════════════════════════════════"
fi

echo ""
echo "Done! 🎉  Upload the wp-plugin/cf-storage/ folder to"
echo "wp-content/plugins/ and activate it in WordPress."
