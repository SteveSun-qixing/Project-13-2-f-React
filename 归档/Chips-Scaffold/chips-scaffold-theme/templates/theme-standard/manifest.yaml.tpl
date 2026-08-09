schemaVersion: "1.0.0"
id: "{{pluginId}}"
name: "{{name}}"
version: "{{version}}"
type: "theme"
publisher: "{{publisher}}"
description: "{{description}}"
permissions:
  - "theme.read"

runtime:
  targets:
    desktop:
      supported: true
    web:
      supported: false
    mobile:
      supported: false
    headless:
      supported: true

entry:
  tokens: "dist/tokens.json"
  themeCss: "dist/theme.css"

# 主题相关配置（供 Theme Runtime 与生态工具使用）
themeId: "{{themeId}}"
displayName: "{{displayName}}"
isDefault: {{isDefault}}
parentTheme: "{{parentThemeId}}"

ui:
  layout:
    owner: page
    unit: cpx
    baseWidth: 1024
    contract: ./contracts/theme-interface.contract.json
    minFunctionalSet: ./contracts/theme-min-functional-set.json
