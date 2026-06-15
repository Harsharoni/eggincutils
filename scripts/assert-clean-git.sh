#!/bin/sh
set -eu

if ! command -v git >/dev/null 2>&1; then
  echo "Deployment blocked: git is required to verify deploy provenance." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Deployment blocked: this build context is not a git work tree." >&2
  exit 1
fi

status="$(git status --porcelain=v1 --untracked-files=all)"
if [ -n "$status" ]; then
  echo "Deployment blocked: commit or stash local changes before deploying." >&2
  echo "$status" >&2
  exit 1
fi

if upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
  local_head="$(git rev-parse HEAD)"
  upstream_head="$(git rev-parse "$upstream")"
  if [ "$local_head" != "$upstream_head" ]; then
    echo "Deployment blocked: HEAD does not match upstream $upstream." >&2
    echo "Run git push or git pull/rebase so deployment matches the branch remote." >&2
    exit 1
  fi
fi
