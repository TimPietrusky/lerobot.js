function generateREADME(metaInfo : string) {
    return `\
---
task_categories:
- robotics
tags:
- LeRobot
- tutorial
configs:
- config_name: default
  data_files: data/*/*.parquet
---

This dataset was created using [LeRobot.js](https://github.com/timpietrusky/lerobot.js) which is based on the [LeRobot](https://github.com/huggingface/lerobot) project

## Dataset Description



- **Homepage:** [More Information Needed]
- **Paper:** [More Information Needed]
- **License:** apache-2.0

## Dataset Structure

[meta/info.json](meta/info.json):
${metaInfo}
`
}

export default generateREADME;
