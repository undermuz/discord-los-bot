#!/bin/sh
set -e

if [ -d /app/data ]; then
    chown -R node:node /app/data
    chmod -R u+rwX /app/data
fi

exec gosu node "$@"
