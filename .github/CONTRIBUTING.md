# Contributing to lerobot.js

Thanks for your interest in contributing! This guide will help you get started.

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/timpietrusky/lerobot.js.git
cd lerobot.js
pnpm install

# Run demo
pnpm dev

# Build packages
pnpm --filter "@lerobot/web" run build
```

## 📦 Package Structure

- **`packages/web/`** - Browser package (`@lerobot/web` on npm)
- **`examples/robot-control-web/`** - Demo application (deployed to HF Spaces)
- **`src/cli/`** - Node.js CLI tool
- **`src/lerobot/node/`** - Node.js library

## 🔄 Making Changes

### 1. Development Workflow

```bash
# Make your changes to packages/web/ or other code
# Test your changes
pnpm dev  # for demo
pnpm --filter "@lerobot/web" run build  # for package

# Run any relevant tests
```

### 2. Creating a Changeset

**For any changes to `packages/web/`:**

```bash
# Describe your changes
pnpm changeset
```

- **Select package**: `@lerobot/web`
- **Version type**:
  - `patch` (0.1.1 → 0.1.2) - Bug fixes
  - `minor` (0.1.1 → 0.2.0) - New features
  - `major` (0.1.1 → 1.0.0) - Breaking changes
- **Summary**: Clear description for changelog

### 3. Submit Pull Request

```bash
git add .
git commit -m "feat: your change description"
git push origin your-branch
```

Create a PR with:

- Clear description of changes
- Reference any related issues
- Include changeset if modifying `@lerobot/web`

## 🚀 Release Process

### Automated Releases (Recommended)

1. **Changeset added** → PR merged to `main`
2. **GitHub Actions** creates Release PR automatically
3. **Maintainer merges** Release PR
4. **Package published** to npm with GitHub release

### Manual Testing

```bash
# Preview version changes (safe)
pnpm changeset:version

# Publish manually (only for emergencies)
pnpm changeset:publish
```

## 📋 Code Standards

### TypeScript

- Use strict TypeScript settings
- Export types explicitly
- Document public APIs with JSDoc

### Code Style

- Follow existing patterns
- Use meaningful variable names
- Add comments for complex logic
- **NO explanation comments** in code (see `docs/conventions.md`)

### Commit Messages

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation
- `chore:` - Maintenance
- `refactor:` - Code restructuring

## 🧪 Testing

### Manual Testing

```bash
# Test demo locally
pnpm dev

# Test CLI
pnpm cli:find-port
pnpm cli:calibrate

# Test package build
pnpm --filter "@lerobot/web" run build
```

### Hardware Testing

- Use SO-100 leader/follower arms when available
- Test calibration, teleoperation, port discovery
- Verify WebSerial API compatibility

## 📝 Documentation

### Update Documentation For:

- New functions in `@lerobot/web`
- CLI command changes
- Hardware support additions
- Breaking changes

### Files to Update:

- `packages/web/README.md` - Package documentation
- `README.md` - Main project overview
- JSDoc comments for new APIs

## 🐛 Bug Reports

Include:

- Steps to reproduce
- Expected vs actual behavior
- Browser/Node.js version
- Hardware setup (if relevant)
- Error messages/console output

## 💡 Feature Requests

- Explain the use case
- Provide examples if possible
- Consider backward compatibility
- Discuss implementation approach

## 🎯 Areas for Contribution

### High Priority

- New robot hardware support
- Browser compatibility improvements
- Performance optimizations
- Documentation improvements

### Medium Priority

- Additional calibration methods
- UI/UX enhancements
- CLI tool features
- Testing infrastructure

### Advanced

- WebRTC integration
- Computer vision features
- Machine learning integration
- Protocol implementations

## 🔧 Development Tips

### Common Commands

```bash
# Install dependencies
pnpm install

# Start demo development
pnpm dev

# Build everything
pnpm build

# Create changeset
pnpm changeset

# Work with specific package
pnpm --filter "@lerobot/web" run build
```

### Debugging

- Use browser DevTools for WebSerial issues
- Check console for hardware communication errors
- Use `console.log` for motor position debugging
- Test with different hardware configurations

## 📞 Getting Help

- **Issues**: Use GitHub issues for bugs/features
- **Discussions**: Use GitHub discussions for questions
- **Hardware**: Check hardware documentation in `docs/`

## 🙏 Recognition

All contributors will be recognized in releases and project documentation. Thank you for helping make robotics more accessible! 🤖✨
