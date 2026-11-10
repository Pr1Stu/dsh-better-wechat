# Agent Preset workspace groups

This optional Host plugin setting is off by default. In the `@xmanrui/dsh-im` plugin config, set `groupByAgentPreset: true` and restart DSH:

```yaml
- insert:
    - id: xmanrui-dsh-im
      name: '@xmanrui/dsh-im'
      config:
        groupByAgentPreset: true
```

For Weixin bots using the default `<DSH_HOME>/im` workspace, newly created Sessions with an explicitly selected Agent Preset use a registered workspace under `presets/<preset-id>`. Manually selected workspaces and conversation-directory overrides take priority.

This changes the workspace of future Sessions only. Existing Sessions and files are left in place. Turning the option off does not delete generated folders. A preset workspace is a shared working directory, not an access-control boundary.
