import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Empty, Input } from "antd";
import {
  flattenThread,
  type NoteThreadItem,
  type SavedNoteAnnot,
} from "../pdf/notes";
import { layoutMarginCards } from "../pdf/note-margin-layout";
import { formatMessage } from "../lib/messages";
import { applyElementRgb } from "./geometry-style";

function formatTime(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 便签颜色点（文档数据颜色，经 CSS 变量写入） */
function NoteDot({ color }: { color: [number, number, number] | null }): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    applyElementRgb(ref.current, "--note-dot", color ?? [1, 0.78, 0.13]);
  }, [color]);
  return <span ref={ref} className="pdf-note-card-dot" />;
}

/** 单条评论 */
function CommentItem({
  item,
  depth,
  onStartEdit,
  onReply,
}: {
  item: NoteThreadItem;
  depth: number;
  onStartEdit: (item: NoteThreadItem) => void;
  onReply: (item: NoteThreadItem, contents: string) => void;
}): ReactElement {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyValue, setReplyValue] = useState("");
  return (
    <div className="pdf-note-comment" data-depth={depth}>
      <div className="pdf-note-comment-head">
        <span className="pdf-note-comment-author">
          {item.author || formatMessage("pdf.note.authorFallback")}
        </span>
        <span className="pdf-note-comment-time">{formatTime(item.timeMs)}</span>
      </div>
      <div className="pdf-note-comment-body">{item.contents}</div>
      <div className="pdf-note-actions">
        <Button
          size="small"
          type="text"
          onClick={() => {
            setReplyOpen((v) => !v);
            setReplyValue("");
          }}
        >
          {formatMessage("pdf.note.reply")}
        </Button>
        {item.saved !== null ? (
          <Button size="small" type="text" onClick={() => onStartEdit(item)}>
            {formatMessage("pdf.note.edit")}
          </Button>
        ) : null}
      </div>
      {replyOpen ? (
        <div className="pdf-note-reply">
          <Input.TextArea
            value={replyValue}
            placeholder={formatMessage("pdf.note.replyPlaceholder")}
            autoSize={{ minRows: 2, maxRows: 5 }}
            onChange={(e) => setReplyValue(e.target.value)}
          />
          <div className="pdf-note-actions">
            <Button
              size="small"
              type="primary"
              onClick={() => {
                onReply(item, replyValue);
                setReplyValue("");
                setReplyOpen(false);
              }}
            >
              {formatMessage("pdf.note.publish")}
            </Button>
          </div>
        </div>
      ) : null}
      {item.replies.map((r) => (
        <CommentItem
          key={r.key}
          item={r}
          depth={depth + 1}
          onStartEdit={onStartEdit}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

/** 线程卡片（含草稿卡）；顶部经 CSS 变量定位 */
function ThreadCard(props: {
  threadKey: string;
  top: number;
  active: boolean;
  children: ReactNode;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--card-top", `${props.top}px`);
  }, [props.top]);
  useEffect(() => {
    if (props.active) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [props.active]);
  return (
    <div
      ref={ref}
      className={`pdf-note-card${props.active ? " pdf-note-card-active" : ""}`}
      data-thread-key={props.threadKey}
    >
      {props.children}
    </div>
  );
}

/**
 * WPS 风格批注边栏：与页面并列的评论列。线程卡片与定位钉齐平、互不重叠；
 * 便签工具激活或存在便签时显示。
 */
export function NoteMargin({
  threads,
  pageHeight,
  scale,
  activeKey,
  draft,
  noteEditDraft,
  setNoteEditDraft,
  editSavedNote,
  replyToNote,
  replyToPending,
  publishDraft,
  cancelDraft,
  draftValue,
  setDraftValue,
}: {
  threads: NoteThreadItem[];
  /** 未缩放页高（显示坐标） */
  pageHeight: number;
  scale: number;
  activeKey: string | null;
  /** 正在输入的便签草稿（键固定为 draft） */
  draft: boolean;
  noteEditDraft: { key: string; contents: string } | null;
  setNoteEditDraft: (draft: { key: string; contents: string } | null) => void;
  editSavedNote: (annot: SavedNoteAnnot, contents: string) => void;
  replyToNote: (annot: SavedNoteAnnot, contents: string) => void;
  replyToPending: (pendingId: string, contents: string) => void;
  publishDraft: () => void;
  cancelDraft: () => void;
  draftValue: string;
  setDraftValue: (v: string) => void;
}): ReactElement {
  const entries = useMemo(() => {
    const list = threads.map((root) => ({
      key: root.key,
      pinY: (pageHeight - root.at[1]) * scale,
    }));
    if (draft) {
      list.push({ key: "draft", pinY: 0 });
    }
    return list;
  }, [draft, pageHeight, scale, threads]);

  const cardHeightsRef = useRef(new Map<string, number>());
  const anchorKey = draft ? "draft" : activeKey;
  const tops = useMemo(
    () =>
      layoutMarginCards(entries, (key) => cardHeightsRef.current.get(key) ?? 96, anchorKey),
    [anchorKey, entries],
  );

  const hasThreads = threads.length > 0 || draft;

  return (
    <aside className="pdf-note-margin" aria-label={formatMessage("pdf.note.title")}>
      <div className="pdf-note-margin-inner">
        {!hasThreads ? (
          <Empty
            className="pdf-note-empty"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={formatMessage("pdf.note.title")}
          />
        ) : null}
        {threads.map((root) => {
          const flat = flattenThread(root);
          const top = tops.get(root.key) ?? 4;
          return (
            <ThreadCard key={root.key} threadKey={root.key} top={top} active={activeKey === root.key}>
              <div
                ref={(el) => {
                  if (el) cardHeightsRef.current.set(root.key, el.offsetHeight || 96);
                }}
              >
                <div className="pdf-note-card-title">
                  <NoteDot color={root.color} />
                  {formatMessage("pdf.note.title")}
                </div>
                {flat.map(({ item, depth }) =>
                  item.saved !== null && noteEditDraft?.key === item.key ? (
                    <div key={item.key} className="pdf-note-comment">
                      <Input.TextArea
                        value={noteEditDraft.contents}
                        autoSize={{ minRows: 2, maxRows: 6 }}
                        onChange={(e) =>
                          setNoteEditDraft({ key: item.key, contents: e.target.value })
                        }
                      />
                      <div className="pdf-note-actions">
                        <Button size="small" onClick={() => setNoteEditDraft(null)}>
                          {formatMessage("pdf.note.cancel")}
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => {
                            if (item.saved) editSavedNote(item.saved, noteEditDraft.contents);
                            setNoteEditDraft(null);
                          }}
                        >
                          {formatMessage("pdf.note.save")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <CommentItem
                      key={item.key}
                      item={item}
                      depth={depth}
                      onStartEdit={(target) => {
                        if (target.saved) {
                          setNoteEditDraft({ key: target.key, contents: target.contents });
                        }
                      }}
                      onReply={(target, contents) => {
                        if (target.saved) replyToNote(target.saved, contents);
                        else if (target.pendingId !== null) replyToPending(target.pendingId, contents);
                      }}
                    />
                  ),
                )}
              </div>
            </ThreadCard>
          );
        })}
        {draft ? (
          <ThreadCard threadKey="draft" top={tops.get("draft") ?? 4} active={true}>
            <div className="pdf-note-card-title">{formatMessage("pdf.note.title")}</div>
            <Input.TextArea
              autoFocus
              value={draftValue}
              placeholder={formatMessage("pdf.note.placeholder")}
              autoSize={{ minRows: 3, maxRows: 8 }}
              onChange={(e) => setDraftValue(e.target.value)}
              onPressEnter={(e) => {
                if ((e as unknown as { shiftKey: boolean }).shiftKey) return;
                e.preventDefault();
                publishDraft();
              }}
            />
            <div className="pdf-note-actions">
              <Button size="small" onClick={cancelDraft}>
                {formatMessage("pdf.note.cancel")}
              </Button>
              <Button size="small" type="primary" onClick={publishDraft}>
                {formatMessage("pdf.note.publish")}
              </Button>
            </div>
          </ThreadCard>
        ) : null}
      </div>
    </aside>
  );
}
