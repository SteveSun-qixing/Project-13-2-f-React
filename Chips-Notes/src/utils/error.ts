export function toDisplayErrorMessage(error: unknown, fallback = '发生未知错误'): string {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
    };

    if (typeof record.message === 'string' && record.message.trim().length > 0) {
      return record.message;
    }

    if (typeof record.code === 'string' && record.code.trim().length > 0) {
      return record.code;
    }

    if (typeof record.details === 'string' && record.details.trim().length > 0) {
      return record.details;
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}
