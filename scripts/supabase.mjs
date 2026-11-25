/**
 * Runs the local Supabase CLI without BUN_INSPECT.
 * VS Code terminals may export BUN_INSPECT, which makes the CLI try to open a
 * debugger port and crash ("Failed to start inspector").
 *
 *   npm run supabase -- <args>
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("supabase/package.json");
const cli = resolve(dirname(pkgPath), require(pkgPath).bin.supabase);

const env = { ...process.env };
delete env.BUN_INSPECT;

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 1));
