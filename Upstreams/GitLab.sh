#!/bin/bash
set -euo pipefail

REMOTE_URL="git@gitlab.com:nickkvasic/WebSocket-Client-TS.git"

if ! git remote get-url gitlab &>/dev/null; then
    git remote add gitlab "$REMOTE_URL"
    echo "Added remote: gitlab -> $REMOTE_URL"
else
    echo "Remote 'gitlab' already exists"
fi

GIT_SSH_COMMAND="ssh -o BatchMode=yes" git push gitlab main
echo "Pushed to GitLab"
