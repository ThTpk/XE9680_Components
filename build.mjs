#!/usr/bin/env node
// Bundles xe9680/main.js and everything it imports — three.js, the two fonts, the base CSS — into a
// single self-contained index.html that opens from file:// and works offline.
//
//   npm install && npm run build
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEPS = path.join(HERE, 'node_modules');
const SRC = path.join(HERE, 'xe9680');
const OUT = path.join(HERE, 'index.html');

const font = (file) => fs.readFileSync(path.join(DEPS, file)).toString('base64');
const mono = (weight) =>
  `@font-face{font-family:'JetBrains Mono';font-weight:${weight};font-style:normal;font-display:block;` +
  `src:url(data:font/woff2;base64,${font(`@fontsource/jetbrains-mono/files/jetbrains-mono-latin-${weight}-normal.woff2`)}) format('woff2');}`;
const FONTS =
  [400, 600, 700].map(mono).join('\n') +
  `\n@font-face{font-family:'Inter';font-weight:100 900;font-style:normal;font-display:block;` +
  `src:url(data:font/woff2;base64,${font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}) format('woff2');}`;

const BASE = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:#e9edf1}
#app{position:fixed;inset:0;color:#101620;font-family:'JetBrains Mono',ui-monospace,monospace;-webkit-font-smoothing:antialiased}
#gl{position:absolute;inset:0;display:block}
`;

const res = await esbuild.build({
  entryPoints: [path.join(SRC, 'main.js')],
  bundle: true,
  nodePaths: [DEPS],
  format: 'esm',
  minify: !process.env.DEBUG,
  write: false,
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');

fs.writeFileSync(
  OUT,
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Dell PowerEdge XE9680 — interactive 3D teardown</title>
<meta name="description" content="An interactive 3D teardown of the Dell PowerEdge XE9680 6U AI server: eight GPUs, two Xeons, six Titanium supplies, sixteen fans and ten PCIe Gen5 slots, with a live power, airflow and acoustic model.">
<style>
${FONTS}
${BASE}
</style>
</head>
<body>
<div id="app"></div>
<script type="module">
${js}
</script>
</body>
</html>
`,
);
console.log(`${OUT}  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
