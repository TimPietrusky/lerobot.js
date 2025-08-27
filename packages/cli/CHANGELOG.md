# lerobot

## 0.3.3

### Patch Changes

- 7ed97a4: use proper version; refactored README to align with other README's

## 0.3.2

### Patch Changes

- e3cb368: refactor: removed "teleop" alias; use same example robot.id

## 0.3.1

### Patch Changes

- 7496471: docs: use "npx lerobot@latest"

## 0.3.0

### Minor Changes

- b2fcd70: improved dx; fixed dependencies

### Patch Changes

- Updated dependencies [b2fcd70]
  - @lerobot/node@0.3.0

## 0.2.0

### Minor Changes

- 443cc20: \# Changes Summary

  \## Features

  \- feat(node): add `connectPort()` function for direct port connections

  \- feat(node): implement proper `findPort()` / `connectPort()` API separation

  \- feat(node): add comprehensive Node.js README with API documentation

  \- feat(lint): add ESLint configuration for both Node.js and Web packages

  \## Fixes

  \- fix(node): resolve motor position reading to return instant real values

  \- fix(node): implement proper calibration flow matching Python lerobot

  \- fix(node): resolve EventEmitter memory leaks in motor communication

  \- fix(examples): update all Node.js examples to use correct API pattern

  \## Documentation

  \- docs(web): clarify `findPort()` vs `connectPort()` API differences

  \- docs: add Python compatibility notes for calibration files

  \## Refactor

  \- refactor: unify `CalibrationResults` type across Node.js and Web packages

  \- refactor: remove legacy type aliases and old `src` folder structure
