import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist');

await mkdir(path.join(outDir, 'assets'), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'audos-workspace/landing-pages/landing.tsx')],
  bundle: true,
  outfile: path.join(outDir, 'assets/main.js'),
  format: 'esm',
  target: ['es2020'],
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  alias: {
    'https://esm.sh/react@18': 'react',
    'https://esm.sh/react-dom@18/client': 'react-dom/client',
  },
});

await copyFile(path.join(root, 'static/index.html'), path.join(outDir, 'index.html'));

console.log('Built Vercel output in dist/');
