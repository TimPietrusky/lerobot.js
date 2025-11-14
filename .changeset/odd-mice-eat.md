---
"@lerobot/web": minor
---

enhance record() api with flexible runtime management and video stream support.

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
