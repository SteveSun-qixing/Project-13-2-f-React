import type { ReactElement } from "react";

export interface OutlineNode {
  title: string;
  bold?: boolean;
  italic?: boolean;
  dest?: unknown;
  url?: string;
  items?: OutlineNode[];
}

function Item({
  node,
  depth,
  onGo,
}: {
  node: OutlineNode;
  depth: number;
  onGo: (n: OutlineNode) => void;
}): ReactElement {
  return (
    <>
      <button
        type="button"
        className="pdf-outline-item"
        data-depth={depth}
        data-bold={node.bold ? "true" : undefined}
        data-italic={node.italic ? "true" : undefined}
        title={node.title}
        onClick={() => onGo(node)}
      >
        {node.title}
      </button>
      {node.items?.map((c, i) => (
        <Item key={i} node={c} depth={depth + 1} onGo={onGo} />
      ))}
    </>
  );
}

/** 书签目录树：点击跳转到内部目的地；url 条目走系统浏览器 */
export function OutlinePanel({
  outline,
  onGoToNode,
}: {
  outline: OutlineNode[];
  onGoToNode: (n: OutlineNode) => void;
}): ReactElement {
  return (
    <div className="pdf-outline">
      {outline.map((n, i) => (
        <Item key={i} node={n} depth={0} onGo={onGoToNode} />
      ))}
    </div>
  );
}
