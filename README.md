# AUDOS.md — LinkNest

> **Auto-generated manifest.** Do not edit manually — this file is regenerated on every push from Audos.

## File Structure

All workspace files live inside `audos-workspace/`. Files outside this folder are ignored during inbound sync.

```
audos-workspace/
  landing-pages/    ← Landing page TSX files (compiled to DB app records)
  mini-apps/        ← Mini-app TSX files (compiled to DB app records)
  components/       ← Shared React components (stored in GCS space files)
  hooks/            ← Custom React hooks
  lib/              ← Utility libraries
  data/             ← JSON data files
  assets/           ← Static assets
```

## Current Apps

### Landing Pages
  - `landing.tsx`

### Mini Apps
  - _(none yet)_

## Compilation Rules

- **Bundler**: ESBuild with JSX automatic runtime
- **Target**: ES2020, ESM format
- **External deps**: React, ReactDOM, Lucide React (resolved via CDN importmap)
- **Single-file TSX**: Each landing page and mini-app is a single `.tsx` file
- **Space files**: Components, hooks, lib, data are stored in GCS and bundled during space compilation

## Sync Behavior

### Inbound (GitHub → Audos)
- Every push triggers a full-tree sync
- `landing-pages/*.tsx` → matched to DB app records by filename → ESBuild compile
- `mini-apps/*.tsx` → matched to DB app records by filename → ESBuild compile
- Other files → written to GCS space storage
- Post-sync: compilation cache cleared + fresh build triggered

### Outbound (Audos → GitHub)
- Manual push from Developer Window
- Commits tagged with `[audos-sync]` to prevent infinite loops
- AUDOS.md regenerated on each push

### Loop Prevention
- Commits containing `[audos-sync]` in the message are skipped during inbound sync

## Tips for AI Agents

- Each app file must be self-contained (single TSX file with all imports)
- Use `SpaceRuntimeContext` for data persistence (not localStorage)
- CDN dependencies are resolved via importmap — don't bundle React
- Test compilation locally with ESBuild before pushing
