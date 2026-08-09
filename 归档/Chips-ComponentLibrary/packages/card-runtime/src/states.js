export function resolveCardCoverFrameState(params) {
  if (params.disabled) {
    return "disabled";
  }

  if (!params.coverUrl) {
    return "empty";
  }

  if (params.loadError) {
    return "error";
  }

  if (params.loading || params.frameStatus === "loading") {
    return "loading";
  }

  if (params.frameStatus === "ready") {
    return "ready";
  }

  return "idle";
}

export function resolveCompositeCardWindowState(params) {
  if (params.disabled) {
    return "disabled";
  }

  if (params.fatalError) {
    return "error";
  }

  if (params.nodeErrorCount > 0) {
    return "degraded";
  }

  if (params.loading || params.phase === "resolving") {
    return "resolving";
  }

  if (params.phase === "rendering") {
    return "rendering";
  }

  if (params.phase === "ready") {
    return "ready";
  }

  return "idle";
}
