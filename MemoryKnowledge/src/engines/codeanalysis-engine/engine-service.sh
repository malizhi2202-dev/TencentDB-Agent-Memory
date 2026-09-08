#!/bin/bash
# Engine service launcher: runs the code-analysis engine (original GitNexus
# LocalBackend) under the glibc-2.34 Node 24 runtime required by its native
# modules (@ladybugdb/core, tree-sitter). Uses a wrapper node binary that
# forces the dynamic loader to the newer glibc so child processes inherit it.
set -e
cd "$(dirname "$0")"
export GITNEXUS_MEMORY=off
export LD_LIBRARY_PATH=/tmp/glibc234/lib/x86_64-linux-gnu:/tmp/glibc234/usr/lib/x86_64-linux-gnu:/tmp/openssl3/usr/lib/x86_64-linux-gnu
exec /tmp/node-glibc234 --import tsx service.ts
