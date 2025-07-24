# Contributing to lerobot.js

## Quick Start

```bash
git clone https://github.com/timpietrusky/lerobot.js.git
cd lerobot.js
pnpm install
```

## Development

### Library + Demo Development (Recommended)

```bash
cd examples/cyberpunk-standalone
pnpm dev
```

Edit `packages/web/src/` → see changes instantly in demo via Vite hot reload.

### Library Only

```bash
cd packages/web
pnpm dev
```

## Releases

For `@lerobot/web` changes:

```bash
pnpm changeset
```

- Select package, version type (patch/minor/major), add description
- Commit the changeset file
- When merged to main, [GitHub Actions](.github/workflows/release.yml) creates a Release PR
- Merge the Release PR → automatic npm publish

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
