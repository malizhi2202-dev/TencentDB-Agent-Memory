import { spawn } from 'child_process';
import { fileURLToPath } from 'node:url';
import { LBUG_MAX_DB_SIZE } from './lbug-config.js';
import { diagnoseExtensionLoad, type ExtensionLoadDiagnosis } from './extension-load-error.js';
import { logger } from '../logger.js';

const DEFAULT_EXTENSION_INSTALL_TIMEOUT_MS = 15_000;
const EXTENSION_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Node binary used for the extension-install child process. Under the glibc
 * wrapper launch, `process.execPath` is the dynamic loader and cannot run a
 * script; use the wrapper node when configured via ENGINE_NODE_BIN.
 */
const childNodeBin: string | null = process.env.ENGINE_NODE_BIN || null;

/**
 * Lifecycle policy for an optional DuckDB extension.
 *
 * - `auto`     — try `LOAD`, fall back to one bounded out-of-process `INSTALL`
 *                attempt per process if `LOAD` fails. Default for analyze.
 * - `load-only`— try `LOAD` only; never spawn an installer. Used by serve/MCP
 *                read paths so user queries never block on a network install.
 * - `never`    — skip the extension entirely. Operators can use this to
 *                forcibly disable optional search features.

(Showing lines 1-18 of 388. Use offset=19 to continue.)