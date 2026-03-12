export class PermissionGuard {
  public check(required: string[], granted: string[] | undefined): boolean {
    if (required.length === 0) {
      return true;
    }

    if (!granted || granted.length === 0) {
      return false;
    }

    const grantedSet = new Set(granted);
    return required.every((permission) => {
      if (grantedSet.has(permission)) {
        return true;
      }

      const separatorIndex = permission.indexOf('.');
      if (separatorIndex <= 0) {
        return false;
      }

      const namespace = permission.slice(0, separatorIndex);
      return grantedSet.has(`${namespace}.manage`);
    });
  }
}
