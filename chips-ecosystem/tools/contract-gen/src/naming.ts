/** ID → TypeScript 常量命名。 */

/** `window:setTitle` → `WINDOW_SET_TITLE`；`file:read` → `FILE_READ`。 */
export function constantName(id: string): string {
  return id
    .split(/[:-]/)
    .flatMap((segment) =>
      segment === segment.toUpperCase() ? [segment] : segment.split(/(?=[A-Z])/)
    )
    .map((segment) => segment.toUpperCase())
    .join('_');
}

export interface NameCollision {
  readonly name: string;
  readonly ids: readonly string[];
}

/** 检测同一常量命名空间内的重名。 */
export function findNameCollisions(ids: readonly string[]): readonly NameCollision[] {
  const byName = new Map<string, string[]>();
  for (const id of ids) {
    const name = constantName(id);
    const bucket = byName.get(name);
    if (bucket === undefined) {
      byName.set(name, [id]);
    } else {
      bucket.push(id);
    }
  }
  const collisions: NameCollision[] = [];
  for (const [name, bucket] of byName) {
    if (bucket.length > 1) {
      collisions.push({ name, ids: bucket });
    }
  }
  return collisions.sort((left, right) => left.name.localeCompare(right.name));
}
