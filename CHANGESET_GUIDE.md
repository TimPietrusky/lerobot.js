# 🚀 Changesets Workflow Guide

## Setup (One Time Only)

### 1. Add NPM Token to GitHub

1. Go to [npmjs.com](https://npmjs.com) → Account → Access Tokens
2. Create **Automation** token with **Publish** permission
3. Copy the token
4. Go to GitHub → Settings → Secrets → Actions
5. Add secret: `NPM_TOKEN` = your token

### 2. Verify Access

Make sure you have publish access to `@lerobot/web` on npm.

## Daily Workflow

### 1. Make Changes

```bash
# Edit code in packages/web/
# Test your changes
pnpm --filter "@lerobot/web" run build
```

### 2. Create Changeset

```bash
pnpm changeset
```

- Select package: `@lerobot/web`
- Choose version bump: `patch` | `minor` | `major`
- Write summary: "Add new feature X" or "Fix bug Y"

### 3. Commit & Push

```bash
git add .
git commit -m "feat: add new functionality"
git push origin main
```

### 4. Magic Happens! ✨

- GitHub Actions creates **Release PR** with changelog
- **Merge the PR** → Automatic publish to npm
- **New version is live!**

## Commands Available

```bash
# Create a changeset (describe your changes)
pnpm changeset

# Preview what will be released
pnpm changeset:version

# Manual publish (emergency only)
pnpm changeset:publish
```

## Version Types

- **patch** (0.1.0 → 0.1.1) - Bug fixes
- **minor** (0.1.0 → 0.2.0) - New features
- **major** (0.1.0 → 1.0.0) - Breaking changes

## Example Flow

```bash
# 1. Edit packages/web/src/calibrate.ts
# 2. Create changeset
pnpm changeset
# → Select @lerobot/web
# → Choose "minor"
# → Summary: "Add new calibration mode"

# 3. Commit
git add .
git commit -m "feat: add new calibration mode"
git push

# 4. GitHub will create Release PR automatically
# 5. Merge PR → @lerobot/web@0.2.0 published! 🎉
```
