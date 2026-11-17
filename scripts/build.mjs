import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const moduleId = manifest.name;
const allowedExternals = new Set(['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']);
let build;
try {
  ({ build } = await import('esbuild'));
} catch (cause) {
  throw new Error('The development bundler is missing. Run npm install, then npm run build.', { cause });
}

const assetGenerator = path.join(root, 'scripts', 'generate-assets.mjs');
try {
  await fs.access(assetGenerator);
} catch {
  throw new Error('scripts/generate-assets.mjs is required before building the theme.');
}
await import(pathToFileURL(assetGenerator).href);
await import('./generate-provenance.mjs');
await fs.mkdir(path.join(root, 'lib'), { recursive: true });

const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/client/index.mjs'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: [...allowedExternals],
  loader: { '.css': 'text' },
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  charset: 'utf8',
  metafile: true,
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: {
    js: `window.__ModuleLoader__.load({id:${JSON.stringify(moduleId)},factory:(require)=>{var module={exports:{}};var exports=module.exports;`,
  },
  footer: { js: 'return module.exports;}});' },
});

for (const output of Object.values(result.metafile.outputs)) {
  for (const request of output.imports) {
    if (request.external && !allowedExternals.has(request.path)) {
      throw new Error(`Unsupported client external: ${request.path}`);
    }
  }
}
for (const output of result.outputFiles) {
  if (!output.path.endsWith('/client.js') && !output.path.endsWith('\\client.js')) {
    throw new Error(`Unexpected client build artifact: ${output.path}`);
  }
  new vm.Script(output.text, { filename: 'client.js' });
  const nativePath = /(?:[A-Za-z]:[\\/](?:Users|AHA|dev)[\\/]|file:\/\/\/)/;
  if (nativePath.test(output.text)) throw new Error('A local filesystem path leaked into the browser bundle.');
  await fs.writeFile(output.path, output.contents);
}
await build({
  absWorkingDir: root,
  entryPoints: ['src/index.mjs'],
  outfile: 'lib/index.js',
  bundle: false,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  legalComments: 'none',
});
const artifact = await fs.stat(path.join(root, 'lib', 'client.js'));
console.log(`Built ${moduleId}: lib/client.js (${artifact.size} bytes), lib/index.js`);
