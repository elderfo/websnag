#!/usr/bin/env bash
# Scan Next.js client bundles for leaked secret key prefixes.
# Run after `next build` to verify no server-only secrets ended up
# in the client-side JavaScript shipped to browsers.
set -euo pipefail

BUNDLE_DIR=".next/static"
SECRET_PATTERNS=("sk-ant-" "sb_secret_" "sk_live_" "sk_test_" "whsec_" "re_")
FOUND=0

if [ ! -d "$BUNDLE_DIR" ]; then
  echo "ERROR: $BUNDLE_DIR not found. Run 'next build' first."
  exit 1
fi

for pattern in "${SECRET_PATTERNS[@]}"; do
  if grep -r "$pattern" "$BUNDLE_DIR" --include="*.js" --include="*.css" -l 2>/dev/null; then
    echo "CRITICAL: Found '$pattern' in client bundle!"
    FOUND=1
  fi
done

if [ $FOUND -eq 1 ]; then
  echo "SECRET LEAK DETECTED in client bundles. Build failed."
  exit 1
fi

echo "Bundle secret scan passed — no secrets found in client bundles."
