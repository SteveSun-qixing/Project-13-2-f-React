{
  "name": "{{pluginId}}",
  "version": "{{version}}",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "build:tokens": "tsx src/build-tokens.ts",
    "build:css": "tsx src/build-css.ts",
    "build:contracts": "tsx src/build-contracts.ts",
    "build": "npm run build:tokens && npm run build:contracts && npm run build:css",
    "validate:theme": "tsx src/validate-theme.ts",
    "validate": "chipsdev validate",
    "package": "chipsdev package",
    "verify": "npm run build && npm run validate:theme && npm test && npm run validate && npm run package",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@chips/theme-contracts": "0.1.0",
    "@types/node": "^22.13.10",
    "chips-sdk": "^0.1.0",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2",
    "vitest": "^3.0.8"
  },
  "volta": {
    "extends": "../../package.json"
  }
}
