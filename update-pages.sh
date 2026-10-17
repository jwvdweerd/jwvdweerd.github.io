#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

node scripts/generate-project-pages.js
node scripts/generate-collection-page.js
node scripts/generate-fotografie-pages.js
node scripts/generate-fotografie-index.js
