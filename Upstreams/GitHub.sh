#!/bin/bash
set -euo pipefail

REMOTE_URL="git@github.com:nickkvasic/WebSocket-Client-TS.git"

if ! git remote get-url github &>/dev/null; then
    git remote add github "$REMOTE_URL"
    echo "Added remote: github -> $REMOTE_URL"
else
    echo "Remote 'github' already exists"
fi

GIT_SSH_COMMAND="ssh -o BatchMode=yes" git push github main
echo "Pushed to GitHub"
