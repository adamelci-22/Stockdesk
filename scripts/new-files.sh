#!/usr/bin/env bash
# Print digests/ and alerts/ markdown files added between two commits.
# Usage: new-files.sh <before> <after>
set -euo pipefail
before="${1:-}"; after="${2:-HEAD}"
if [ -z "$before" ] || [ "$before" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$before^{commit}" 2>/dev/null; then
  git diff-tree --root --no-commit-id --name-only --diff-filter=A -r "$after" -- 'digests/*.md' 'alerts/*.md'
else
  git diff --name-only --diff-filter=A "$before" "$after" -- 'digests/*.md' 'alerts/*.md'
fi | grep -v '/_' || true
