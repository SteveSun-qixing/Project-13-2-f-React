/**
 * Markdown 渲染器组件
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps): React.ReactElement {
  const components = useMemo(() => ({
    code({ inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');

      if (!inline && match) {
        return (
          <div className="markdown-code-block">
            <pre>
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    a({ href, children }: any) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="markdown-link"
        >
          {children}
        </a>
      );
    },
    h1: ({ children }: any) => <h1 className="markdown-h1">{children}</h1>,
    h2: ({ children }: any) => <h2 className="markdown-h2">{children}</h2>,
    h3: ({ children }: any) => <h3 className="markdown-h3">{children}</h3>,
    h4: ({ children }: any) => <h4 className="markdown-h4">{children}</h4>,
    h5: ({ children }: any) => <h5 className="markdown-h5">{children}</h5>,
    h6: ({ children }: any) => <h6 className="markdown-h6">{children}</h6>,
    blockquote: ({ children }: any) => <blockquote className="markdown-blockquote">{children}</blockquote>,
    table: ({ children }: any) => <table className="markdown-table">{children}</table>,
    img: ({ src, alt }: any) => <img src={src} alt={alt} className="markdown-image" />,
  }), []);

  return (
    <div className="markdown-renderer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
