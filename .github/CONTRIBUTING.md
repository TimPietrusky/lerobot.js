# Contributing to lerobot.js

## Quick Start

```bash
git clone https://github.com/timpietrusky/lerobot.js.git
cd lerobot.js
pnpm install
```

## Development

### Library + Demo Development (Recommended)

**Terminal 1:**

```bash
cd packages/web
pnpm build:watch
```

**Terminal 2:**

```bash
cd examples/cyberpunk-standalone
npm run dev
```

Edit `packages/web/src/` → see changes instantly in demo.

### Library Only

```bash
cd packages/web
pnpm build    # Build once
pnpm dev      # Tests in watch mode
```

### Examples Only

```bash
pnpm example:cyberpunk
pnpm example:iframe-test
pnpm example:sequential-test
```

## Releases

For `@lerobot/web` changes:

```bash
pnpm changeset
```

Select package, version type (patch/minor/major), add description.

## Code Standards

- Follow existing patterns
- Use TypeScript strict mode
- No explanation comments (see `docs/conventions.md`)

## Commit Format

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation
- `chore:` - Maintenance

## Bug Reports

Include: steps to reproduce, expected vs actual behavior, browser/Node version, hardware setup, error messages.
