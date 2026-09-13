#!/usr/bin/env bash
set -euo pipefail

echo "QuickStory Cloudflare setup"
echo "This script creates the two storage buckets. D1 prints an ID that must be placed in wrangler.jsonc."

npx wrangler login
npx wrangler r2 bucket create quickstory-media || true
npx wrangler r2 bucket create quickstory-media-dev || true
npx wrangler d1 create quickstory-db

echo
echo "Next: replace the all-zero D1 database ID in wrangler.jsonc, then run:"
echo "  npx wrangler d1 migrations apply quickstory-db --remote"
echo "  npm run deploy"
