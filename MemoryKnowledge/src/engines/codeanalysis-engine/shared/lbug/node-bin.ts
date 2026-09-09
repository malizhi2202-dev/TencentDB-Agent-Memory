/**
 * [TDAI local adaptation] Node binary resolution for child-process respawns.
 *
 * Why this exists: on hosts whose system glibc is older than the one
 * @ladybugdb/core's prebuilt native module requires (e.g. Ubuntu 20.04 /
 * glibc 2.31 vs the module's GLIBC_2.34 + OpenSSL 3 requirement), the engine
 * runs under a dynamic-loader wrapper (see `engine-service.sh`):
 *
 *   /tmp/node-glibc234 --import tsx service.ts
 *
 * where `/tmp/node-glibc234` is a small script exec-ing
 * `ld-linux(2.34) --library-path <glibc234>:<openssl3> node "$@"`.
 *
 * Under that wrapper `process.execPath` points at the LOADER
 * (`ld-linux-x86-64.so.2`), not node, so `spawn(process.execPath, [script])`
 * makes the loader try to map a `.mjs`/`.ts` file as ELF ("invalid ELF
 * header", exit 127). `GITNEXUS_MEMORY=off` already keeps the analyze
 * auto-respawn from firing under the wrapper; the remaining intentional
 * child processes (extension installer, native-load probe) need a real
 * node-capable binary instead.
 *
 * `ENGINE_NODE_BIN` is that override. Point it at the wrapper script itself
 * (it execs node, so it accepts the same argv as node) when launching the
 * engine, and every respawn below goes through the glibc-2.34 runtime too —
 * the child inherits the loader environment, keeping native module loads
 * consistent with the parent process.
 *
 * Resolution order:
 *   1. `ENGINE_NODE_BIN` (explicit operator override, e.g. the wrapper);
 *   2. `process.execPath` (vanilla node / electron — upstream behavior).
 */
export const resolveNodeBin = (): string =>
  process.env.ENGINE_NODE_BIN ?? process.execPath;
