#!/bin/bash
# PostToolUse hook: auto-format files Claude edits, so formatting diffs never
# pile up between turns. Receives the tool payload as JSON on stdin.
file=$(python3 -c "import json,sys;print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc)
    cd "${CLAUDE_PROJECT_DIR:-.}" && bunx biome check --write "$file" >/dev/null 2>&1 || true
    ;;
esac
exit 0
