{
  "name": "{{ PLUGIN_ID }}",
  "version": "{{ VERSION }}",
  "private": false,
  "type": "commonjs",
  "scripts": {
    "dev": "chipsdev-r server",
    "build": "chipsdev-r build",
    "test": "chipsdev-r test",
    "lint": "chipsdev-r lint",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "validate": "chipsdev-r validate",
    "package": "chipsdev-r package",
    "verify": "npm run lint && npm run typecheck && npm test && npm run build && npm run validate && npm run package"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "typescript": "^5.8.2",
    "vitest": "^3.0.8",
    "eslint": "^8.57.1",
    "@typescript-eslint/parser": "^7.18.0",
    "chips-sdk": "^0.1.0"
  }
}
