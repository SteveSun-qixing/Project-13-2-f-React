id: {{ PLUGIN_ID }}
name: {{ DISPLAY_NAME }}
version: {{ VERSION }}
type: app
entry: dist/index.html

description: {{ DISPLAY_NAME }} 是运行在薯片 Host surface 中的应用插件。

author:
  name: {{ AUTHOR_NAME }}
  email: {{ AUTHOR_EMAIL }}

keywords:
  - chips
  - app
  - surface

permissions:
  - command.read
  - command.write
  - command.invoke

runtime:
  targets:
    desktop:
      supported: true
    web:
      supported: false
    mobile:
      supported: false
    headless:
      supported: false

capabilityFallbacks:
  open-file:
    whenUnsupported: reject
  save-file:
    whenUnsupported: reject

cli:
  commands:
    - commandPath: {{ CLI_COMMAND_ROOT }} open
      target:
        type: app
        pluginId: {{ PLUGIN_ID }}
        surface:
          open: true
          focus: true
          reuse: preferred
      titleKey: app.cli.open.title
      descriptionKey: app.cli.open.description
      arguments:
        - name: subject
          position: 0
          type: string
          required: false
          mapsTo: subject
          ui:
            control: pasteBox
            placeholderKey: app.cli.open.subjectPlaceholder
      output:
        mode: json

engines:
  chips: "^1.0.0"

os:
  - darwin
  - win32
  - linux

ui:
  layout:
    owner: page
    unit: cpx
    baseWidth: 1024
  launcher:
    displayName: {{ DISPLAY_NAME }}
    icon: assets/icons/app-icon.ico
  surface:
    defaultKind: window
    preferredKinds:
      desktop: window
      web: route
      mobile: fullscreen
      headless: window
  window:
    chrome:
      frame: true
