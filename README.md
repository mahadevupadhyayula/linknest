# linknest

Static landing page rebuilt to match the current Audos-style layout and content.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

### One-time setup

```bash
npm install
```

### Deploy preview

```bash
npx vercel
```

### Deploy production

```bash
npx vercel --prod
```

If prompted, choose the current directory and keep the detected Vite settings. The app entrypoint is `audos-workspace/landing-pages/landing.tsx`.
