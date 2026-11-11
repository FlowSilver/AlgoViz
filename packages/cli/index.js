#!/usr/bin/env node
import { readFile, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { build } from "esbuild";
import { indexRun } from "../core/comparison.js";
import { loadReplay } from "../core/index.js";
import { loadViews } from "../core/protocol.js";

const inspector = new URL("../../apps/inspector/", import.meta.url);
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const usage = `Usage:
  algoviz validate <visualization.json> <trace.jsonl>
  algoviz preview <visualization.json> <trace.jsonl> [--output <preview.html>] [--renderer <name=file>]
  algoviz compare <left-spec> <left-trace> <right-spec> <right-trace> [--output <preview.html>] [--renderer <name=file>]
`;

async function readUtf8(path) {
  const bytes = await readFile(path);
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error(`${path}: expected UTF-8 text`);
  }
}

async function bundleLicenses(inputs) {
  const packages = new Set();
  for (const input of Object.keys(inputs)) {
    const path = resolve(projectRoot, input).replaceAll("\\", "/");
    const packageDirectory = /^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(path)?.[1];
    if (packageDirectory) packages.add(packageDirectory);
  }
  const licenses = [await readFile(join(projectRoot, "LICENSE"), "utf8")];
  for (const directory of [...packages].sort()) {
    const files = (await readdir(directory)).filter((file) => /^licen[cs]e(?:\..+)?$/i.test(file));
    for (const file of files.sort()) {
      licenses.push(`${basename(directory)}\n\n${await readFile(join(directory, file), "utf8")}`);
    }
  }
  return licenses.join("\n\n").replaceAll("-->", "-- >");
}

async function previewHtml(data, renderer) {
  const entry = (path) => JSON.stringify(path.replaceAll("\\", "/"));
  const inspectorEntry = entry(fileURLToPath(new URL("index.js", inspector)));
  const plugin = renderer ? `import render from ${entry(renderer.path)};\n` : "";
  const registry = renderer ? `new Map([[${JSON.stringify(renderer.name)}, render]])` : "new Map()";
  const [template, styles, bundle] = await Promise.all([
    readFile(new URL("index.html", inspector), "utf8"),
    readFile(new URL("style.css", inspector), "utf8"),
    build({
      absWorkingDir: projectRoot,
      stdin: {
        contents: `${plugin}import { start } from ${inspectorEntry};\nstart(${registry});`,
        resolveDir: projectRoot,
      },
      platform: "browser",
      format: "iife",
      bundle: true,
      minify: true,
      legalComments: "inline",
      metafile: true,
      write: false,
    }),
  ]);
  const parts = {
    STYLES: styles,
    DATA: JSON.stringify(data).replaceAll("<", "\\u003c"),
    SCRIPT: bundle.outputFiles[0].text,
    LICENSES: await bundleLicenses(bundle.metafile.inputs),
  };
  return template.replace(/%(STYLES|DATA|SCRIPT|LICENSES)%/g, (_, name) => parts[name]);
}

function readRenderer(value) {
  if (value === undefined) return undefined;
  const match = /^([a-z][a-z0-9-]*)=(.+)$/.exec(value);
  if (!match) throw new Error("Expected --renderer name=path-to-module");
  return { name: match[1], path: resolve(match[2]) };
}

async function readRun(specPath, tracePath) {
  const [specText, traceText] = await Promise.all([readUtf8(specPath), readUtf8(tracePath)]);
  return { specText, traceText, traceSource: tracePath, specSource: specPath };
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { help: { type: "boolean", short: "h" }, output: { type: "string" }, renderer: { type: "string" } },
  });
  if (values.help) {
    console.log(usage.trimEnd());
    return;
  }
  const [command, ...paths] = positionals;
  if (!["validate", "preview", "compare"].includes(command)
      || paths.length !== (command === "compare" ? 4 : 2)
      || (command === "validate" && (values.output !== undefined || values.renderer !== undefined))) {
    throw new Error(usage.trimEnd());
  }

  const renderer = readRenderer(values.renderer);
  const runs = await Promise.all([readRun(paths[0], paths[1]), ...(command === "compare" ? [readRun(paths[2], paths[3])] : [])]);
  for (const run of runs) {
    if (command !== "validate") {
      for (const view of loadViews(run.specText, run.specSource)) {
        if (view.type === "custom" && view.renderer !== renderer?.name) {
          throw new Error(`${run.specSource}: renderer "${view.renderer}" requires --renderer ${view.renderer}=<file>`);
        }
      }
    }
    if (command === "compare") {
      indexRun(run);
    } else {
      const replay = loadReplay(run.traceText, run);
      replay.seek(replay.lastStep);
      if (command === "validate") {
        const count = replay.lastStep + 1;
        console.log(`Validated ${count} replay ${count === 1 ? "state" : "states"}.`);
        return;
      }
    }
  }

  const html = await previewHtml({ runs: runs.map((run) => ({
    ...run, traceSource: basename(run.traceSource), specSource: basename(run.specSource),
  })) }, renderer);
  const destination = values.output === undefined
    ? join(await mkdtemp(join(tmpdir(), "algoviz-")), "preview.html")
    : resolve(values.output);
  await writeFile(destination, html, { encoding: "utf8", flag: "wx" });
  console.log(`Open ${pathToFileURL(destination).href}`);
}

try {
  await main();
} catch (error) {
  console.error(error.code === "EEXIST" ? `Preview already exists at ${error.path}. Choose a new output path.` : error.message);
  process.exitCode = 1;
}
