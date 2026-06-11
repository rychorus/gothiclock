#!/bin/bash

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
TEMP_WORKTREE="$(mktemp -d /tmp/gothiclock-gh-pages.XXXXXX)"
REMOVE_WORKTREE=0

cleanup() {
  if [[ "${REMOVE_WORKTREE}" -eq 1 ]]; then
    git -C "${REPO_ROOT}" worktree remove --force "${TEMP_WORKTREE}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TEMP_WORKTREE}"
}

trap cleanup EXIT

cd "${REPO_ROOT}"

echo "Building site..."
npm run build

echo "Preparing gh-pages worktree..."
if git show-ref --verify --quiet refs/heads/gh-pages; then
  git worktree add "${TEMP_WORKTREE}" gh-pages >/dev/null
else
  git branch gh-pages >/dev/null
  git worktree add "${TEMP_WORKTREE}" gh-pages >/dev/null
fi
REMOVE_WORKTREE=1

echo "Syncing dist/ to gh-pages..."
find "${TEMP_WORKTREE}" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
rsync -a --delete --exclude .git "${REPO_ROOT}/dist/" "${TEMP_WORKTREE}/"
touch "${TEMP_WORKTREE}/.nojekyll"

cd "${TEMP_WORKTREE}"
git add -A

if git diff --cached --quiet; then
  echo "No GitHub Pages changes to deploy."
else
  git commit -m "Deploy site to GitHub Pages"
fi

echo "Pushing gh-pages..."
git push origin gh-pages

echo "GitHub Pages deploy complete."
