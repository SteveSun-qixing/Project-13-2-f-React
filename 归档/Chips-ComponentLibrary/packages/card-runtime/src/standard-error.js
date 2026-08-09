export function toStandardError(error, fallbackCode) {
  if (error && typeof error === "object") {
    const candidate = error;
    if (typeof candidate.code === "string" && typeof candidate.message === "string") {
      return {
        code: candidate.code,
        message: candidate.message,
        details: candidate.details,
        retryable: candidate.retryable === true
      };
    }
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message,
      details: { name: error.name },
      retryable: false
    };
  }

  return {
    code: fallbackCode,
    message: "Unknown error",
    details: error,
    retryable: false
  };
}
