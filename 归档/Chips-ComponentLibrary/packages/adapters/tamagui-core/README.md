# @chips/tamagui-core-adapter

Token mapping helpers for Tamagui Core integration.

## APIs

- `flattenTokenTree(tokenTree)`
- `createTokenResolver(flatTokens)`
- `createScopedTokenResolver({ scopes, fallbackTokens, onDiagnostic })`
- `resolveScopedTokenValue(tokenKey, scopedTokenMaps, fallbackTokens)`
- `createThemeCacheKey(themeId, version)`
- `createTamaguiCoreTokens(tokenTree)`
- `THEME_SCOPE_CHAIN_LOW_TO_HIGH`
- `THEME_SCOPE_CHAIN_HIGH_TO_LOW`
