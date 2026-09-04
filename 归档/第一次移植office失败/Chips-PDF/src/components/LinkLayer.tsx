import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfRectToCss } from "../pdf/geometry";
import type { PageGeom } from "../pdf/geometry";
import { applyElementBox } from "./geometry-style";

interface LinkItem {
  rect: [number, number, number, number];
  url?: string;
  dest?: unknown;
}

interface RawLinkAnnotation {
  subtype?: string;
  rect?: number[];
  url?: string;
  dest?: unknown;
}

function LinkArea({
  link,
  geom,
  scale,
  onGoToDest,
  onOpenExternal,
}: {
  link: LinkItem;
  geom: PageGeom;
  scale: number;
  onGoToDest: (dest: unknown) => void;
  onOpenExternal: (url: string) => void;
}): ReactElement {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    applyElementBox(el, pdfRectToCss(geom, link.rect, scale));
  }, [geom, link.rect, scale]);
  return (
    <a
      ref={ref}
      className="pdf-link"
      href={link.url ?? "#"}
      title={link.url}
      target={link.url ? "_blank" : undefined}
      rel="noreferrer"
      onClick={(e) => {
        if (link.url) {
          e.preventDefault();
          onOpenExternal(link.url);
        } else {
          e.preventDefault();
          onGoToDest(link.dest);
        }
      }}
    />
  );
}

/** 链接批注热区：外链交给宿主打开，内部目的地跳页 */
export function LinkLayer({
  doc,
  pageNo,
  geom,
  scale,
  onGoToDest,
  onOpenExternal,
}: {
  doc: PDFDocumentProxy;
  pageNo: number;
  geom: PageGeom;
  scale: number;
  onGoToDest: (dest: unknown) => void;
  onOpenExternal: (url: string) => void;
}): ReactElement | null {
  const [links, setLinks] = useState<LinkItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const page = await doc.getPage(pageNo);
      const annots = (await page.getAnnotations()) as RawLinkAnnotation[];
      if (cancelled) return;
      const out: LinkItem[] = [];
      for (const a of annots) {
        if (a.subtype !== "Link" || !Array.isArray(a.rect) || a.rect.length !== 4 || (!a.url && !a.dest)) {
          continue;
        }
        out.push({ rect: a.rect as LinkItem["rect"], url: a.url, dest: a.dest });
      }
      setLinks(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNo]);

  if (!links || links.length === 0) return null;

  return (
    <div className="pdf-link-layer">
      {links.map((l, i) => (
        <LinkArea
          key={i}
          link={l}
          geom={geom}
          scale={scale}
          onGoToDest={onGoToDest}
          onOpenExternal={onOpenExternal}
        />
      ))}
    </div>
  );
}
