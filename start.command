#!/bin/zsh
cd "$(dirname "$0")"
export NODE_PATH="/Users/shimengting/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"
"/Users/shimengting/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" server.js
