#!/usr/bin/env bash
# Install or uninstall the uat pre-commit hook.
#
# Usage:
#   ./setup-hooks.sh install   — install the pre-commit hook
#   ./setup-hooks.sh uninstall — remove the pre-commit hook
#   ./setup-hooks.sh status    — check if installed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_SOURCE="${SCRIPT_DIR}/hooks/pre-commit"

# Find the git repo root (walk up from CWD)
find_git_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -d "$dir/.git" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

GIT_ROOT="$(find_git_root)" || {
  echo "Error: not inside a git repository."
  exit 1
}

HOOKS_DIR="${GIT_ROOT}/.git/hooks"
HOOK_TARGET="${HOOKS_DIR}/pre-commit"

case "${1:-status}" in
  install)
    mkdir -p "$HOOKS_DIR"

    if [ -f "$HOOK_TARGET" ] && ! grep -q "uat-pre-commit-hook" "$HOOK_TARGET"; then
      echo "Warning: existing pre-commit hook found. Backing up to pre-commit.bak"
      cp "$HOOK_TARGET" "${HOOK_TARGET}.bak"
    fi

    cp "$HOOK_SOURCE" "$HOOK_TARGET"
    chmod +x "$HOOK_TARGET"
    echo "Pre-commit hook installed at ${HOOK_TARGET}"
    echo ""
    echo "Configuration (env vars or .env file):"
    echo "  LINK_CHECK_PORT=3000      # dev server port (default: 3000)"
    echo "  LINK_CHECK_MAX_PAGES=50   # max pages to check (default: 50)"
    echo "  LINK_CHECK_BROWSER=1      # enable Playwright browser checks (default: off)"
    echo "  LINK_CHECK_DISABLED=1     # skip the hook entirely"
    echo ""
    echo "To disable permanently:"
    echo "  git config hooks.linkcheck false"
    echo ""
    echo "To uninstall:"
    echo "  ./setup-hooks.sh uninstall"
    ;;

  uninstall)
    if [ -f "$HOOK_TARGET" ] && grep -q "uat-pre-commit-hook" "$HOOK_TARGET"; then
      rm "$HOOK_TARGET"
      echo "Pre-commit hook removed."
      if [ -f "${HOOK_TARGET}.bak" ]; then
        mv "${HOOK_TARGET}.bak" "$HOOK_TARGET"
        echo "Restored previous pre-commit hook from backup."
      fi
    else
      echo "uat pre-commit hook not found."
    fi
    ;;

  status)
    if [ -f "$HOOK_TARGET" ] && grep -q "uat-pre-commit-hook" "$HOOK_TARGET"; then
      echo "uat pre-commit hook is INSTALLED"
      if [ "$(git config --bool hooks.linkcheck 2>/dev/null)" = "false" ]; then
        echo "  (DISABLED via git config)"
      fi
      echo ""
      echo "Current configuration:"
      echo "  LINK_CHECK_PORT=${LINK_CHECK_PORT:-3000 (default)}"
      echo "  LINK_CHECK_MAX_PAGES=${LINK_CHECK_MAX_PAGES:-50 (default)}"
      echo "  LINK_CHECK_BROWSER=${LINK_CHECK_BROWSER:-off (default)}"
      echo "  LINK_CHECK_DISABLED=${LINK_CHECK_DISABLED:-off (default)}"
      if [ -f "${GIT_ROOT}/.env" ]; then
        echo ""
        echo "  .env file found — will be loaded at runtime"
      else
        echo ""
        echo "  No .env file found. Set env vars directly or create .env in ${GIT_ROOT}"
      fi
    else
      echo "uat pre-commit hook is NOT installed"
      echo "  Run: ./setup-hooks.sh install"
    fi
    ;;

  *)
    echo "Usage: $0 {install|uninstall|status}"
    exit 1
    ;;
esac
