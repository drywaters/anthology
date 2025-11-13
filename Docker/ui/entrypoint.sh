#!/bin/sh
set -eu

CONFIG_DIR="/usr/share/nginx/html/assets"
CONFIG_FILE="$CONFIG_DIR/runtime-config.js"
DEFAULT_FILE="$CONFIG_DIR/runtime-config.default.js"

mkdir -p "$CONFIG_DIR"

if [ -n "${NG_APP_API_URL:-}" ]; then
    escaped=$(printf '%s' "$NG_APP_API_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf 'window.NG_APP_API_URL = "%s";\n' "$escaped" > "$CONFIG_FILE"
elif [ -f "$DEFAULT_FILE" ]; then
    cp "$DEFAULT_FILE" "$CONFIG_FILE"
fi

exec "$@"
