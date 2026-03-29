# linknest

Static landing page rebuilt to match the current Audos-style layout and content.

## Run locally

```bash
npm install
npm run build
```

Then open `dist/index.html` in your browser.

## Deploy to Vercel

1. Install Vercel CLI if needed:
   ```bash
   npm i -g vercel
   ```
2. Authenticate:
   ```bash
   vercel login
   ```
3. Deploy production:
   ```bash
   npm run vercel:deploy
   ```

Vercel will use `vercel.json` to run `npm run build` and publish `dist/`.
