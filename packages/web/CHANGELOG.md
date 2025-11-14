# @lerobot/web

## 0.5.0

### Minor Changes

- b7ce6b9: enhance record() api with flexible runtime management and video stream support.

  add videoStreams and robotType to RecordConfig for upfront configuration.
  expose episode management methods on RecordProcess:

  - getEpisodeCount() / getEpisodes() - introspect recorded episodes
  - clearEpisodes() - delete all episodes
  - nextEpisode() - create new episode segment
  - restoreEpisodes() - restore persisted episodes

  expose dynamic camera management methods:

  - addCamera(name, stream) - add camera during recording
  - removeCamera(name) - remove camera

  all functionality previously requiring direct LeRobotDatasetRecorder access
  now available through clean, type-safe RecordProcess interface. supports both
  upfront configuration and runtime operations for maximum flexibility.

  update demo to use unified record() api exclusively, removing direct recorder
  access and supporting all advanced features (episode management, dynamic cameras,
  custom metadata) through consistent api surface.

## 0.4.0

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

## 0.3.0

### Minor Changes

- 4b4a322: added dataset recording; hf uploader; s3 uploader

## 0.2.2

### Patch Changes

- 5a098c4: fix: make sure that findPort works in iframe

## 0.2.1

### Patch Changes

- 66cb510: fix: trigger WebSerial and WebUSB with the same user gesture

## 0.2.0

### Minor Changes

- 34a86bc: \* clean api for findPort, calibrate \& teleoperate \* moved types into separate files \* a lot of clean up

## 0.1.1

### Patch Changes

- prepare "web" for release on npm
