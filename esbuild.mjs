import * as esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const prod = process.argv.includes("--production") || !watch;

/** Extension host bundle (Node / CommonJS). */
const hostOptions = {
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"],
  sourcemap: !prod,
  minify: prod,
  logLevel: "info",
};

/**
 * Webview bundle (browser / IIFE). Plotly is bundled here as a partial build:
 * only the scatter, scatter3d and histogram trace modules are registered, which
 * keeps the payload around ~1.1 MB instead of ~3.5 MB for the full dist.
 */
const webviewOptions = {
  entryPoints: ["src/webview/main.ts"],
  outfile: "media/webview.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2021",
  mainFields: ["browser", "module", "main"],
  sourcemap: !prod,
  minify: prod,
  define: {
    "process.env.NODE_ENV": prod ? '"production"' : '"development"',
    global: "window",
  },
  logLevel: "info",
};

async function copyStatic() {
  await mkdir("media", { recursive: true });
  await copyFile("src/webview/ui.css", "media/ui.css");
}

if (watch) {
  const [hostCtx, webCtx] = await Promise.all([
    esbuild.context(hostOptions),
    esbuild.context(webviewOptions),
  ]);
  await copyStatic();
  await Promise.all([hostCtx.watch(), webCtx.watch()]);
  console.log("esbuild: watching…");
} else {
  await Promise.all([
    esbuild.build(hostOptions),
    esbuild.build(webviewOptions),
    copyStatic(),
  ]);
  console.log("esbuild: build complete");
}
