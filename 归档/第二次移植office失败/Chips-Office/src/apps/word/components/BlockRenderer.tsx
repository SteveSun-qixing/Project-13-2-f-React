import React, { useCallback, useMemo } from 'react';
import type { Block, Run, TableModel, TableCell, ParaAlign } from '../../../engine/docx-engine/src/types';
import type { PageDimensions } from '../types';

interface BlockRendererProps {
  block: Block;
  pageDimensions: PageDimensions;
  zoom: number;
  isSelected: boolean;
  readOnly: boolean;
  onBlockClick: (blockId: string) => void;
  onTextSelect?: (blockId: string, selection: { start: number; end: number }) => void;
}

export function BlockRenderer({
  block,
  pageDimensions,
  zoom,
  isSelected,
  readOnly,
  onBlockClick,
  onTextSelect,
}: BlockRendererProps) {
  const handleClick = useCallback(() => {
    onBlockClick(block.id);
  }, [block.id, onBlockClick]);

  const style = useMemo(() => getBlockStyle(block, pageDimensions, zoom), [block, pageDimensions, zoom]);

  switch (block.type) {
    case 'paragraph':
    case 'heading':
    case 'listItem':
      return (
        <div
          className={`word-block word-block--${block.type}${isSelected ? ' word-block--selected' : ''}`}
          style={style}
          onClick={handleClick}
          data-block-id={block.id}
          data-block-type={block.type}
        >
          {renderRuns(block.runs || [], block.format)}
        </div>
      );

    case 'table':
      return (
        <div
          className={`word-block word-block--table${isSelected ? ' word-block--selected' : ''}`}
          style={style}
          onClick={handleClick}
          data-block-id={block.id}
          data-block-type="table"
        >
          {renderTable(block.table, pageDimensions, zoom)}
        </div>
      );

    case 'image':
      return (
        <div
          className={`word-block word-block--image${isSelected ? ' word-block--selected' : ''}`}
          style={style}
          onClick={handleClick}
          data-block-id={block.id}
          data-block-type="image"
        >
          {renderImage(block)}
        </div>
      );

    case 'passthrough':
      return (
        <div
          className={`word-block word-block--passthrough`}
          style={style}
          onClick={handleClick}
          data-block-id={block.id}
          data-block-type="passthrough"
        >
          {block.previewText || '[嵌入式内容]'}
        </div>
      );

    default:
      return (
        <div
          className="word-block word-block--unknown"
          style={style}
          onClick={handleClick}
          data-block-id={block.id}
        >
          [{block.type}]
        </div>
      );
  }
}

function renderRuns(runs: Run[], format?: Block['format']): React.ReactNode {
  if (!runs || runs.length === 0) {
    return <span className="word-run word-run--empty">&nbsp;</span>;
  }

  return runs.map((run, index) => {
    const runStyle = getRunStyle(run);
    let content: React.ReactNode = run.text;

    if (run.image) {
      return (
        <span key={index} className="word-run word-run--image" style={runStyle}>
          <img
            src={run.image.dataUrl}
            alt=""
            style={{
              maxWidth: run.image.widthPx ? `${run.image.widthPx}px` : undefined,
              maxHeight: run.image.heightPx ? `${run.image.heightPx}px` : undefined,
              display: 'inline-block',
            }}
          />
        </span>
      );
    }

    if (run.math?.omml) {
      return (
        <span key={index} className="word-run word-run--math" style={runStyle}>
          <span className="word-math" title="数学公式">
            {content}
          </span>
        </span>
      );
    }

    if (run.noteRef) {
      return (
        <sup key={index} className="word-run word-run--note-ref" style={runStyle}>
          {content}
        </sup>
      );
    }

    return (
      <span key={index} className="word-run" style={runStyle}>
        {content}
      </span>
    );
  });
}

function renderTable(table: TableModel | undefined, pageDimensions: PageDimensions, zoom: number): React.ReactNode {
  if (!table || !table.rows || table.rows.length === 0) {
    return <div className="word-table word-table--empty">表格为空</div>;
  }

  const scale = zoom / 100;
  const totalWidth = pageDimensions.widthTwips * scale;

  const tableStyle: React.CSSProperties = {
    width: `${totalWidth}px`,
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  };

  if (table.fill) {
    tableStyle.backgroundColor = `#${table.fill}`;
  }

  // 每行内各单元格的网格起始列号（按 colSpan 累计，gridGap 占位格同样占列），
  // 用于跨行合并（w:vMerge）在后续行中按网格位置对位
  const gridStarts: number[][] = table.rows.map((row) => {
    let gridPos = 0;
    return row.map((cell) => {
      const start = gridPos;
      gridPos += cell.colSpan ?? 1;
      return start;
    });
  });

  // OOXML 垂直合并语义（引擎 TableCell 无 rowSpan，用 vMerge 表达）：
  // 'restart' 开启合并，后续行同一网格位置上的 'continue' 单元格被吸收；
  // 映射为 HTML rowSpan：只有 restart 单元格输出，continue 单元格不再渲染
  const computeRowSpan = (rowIndex: number, colIndex: number): number | undefined => {
    if (table.rows[rowIndex][colIndex].vMerge !== 'restart') {
      return undefined;
    }
    const gridPos = gridStarts[rowIndex][colIndex];
    let span = 1;
    for (let nextRow = rowIndex + 1; nextRow < table.rows.length; nextRow += 1) {
      const mergedCell = table.rows[nextRow].find(
        (candidate, candidateIndex) => gridStarts[nextRow][candidateIndex] === gridPos
      );
      if (!mergedCell || mergedCell.vMerge !== 'continue') {
        break;
      }
      span += 1;
    }
    return span;
  };

  return (
    <table className="word-table" style={tableStyle}>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="word-table__row">
            {row.map((cell, cellIndex) => {
              if (cell.vMerge === 'continue') {
                return null;
              }
              return (
                <td
                  key={cellIndex}
                  className="word-table__cell"
                  style={getTableCellStyle(cell, table)}
                  rowSpan={computeRowSpan(rowIndex, cellIndex)}
                  colSpan={cell.colSpan}
                >
                  {renderTableCell(cell)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderTableCell(cell: TableCell): React.ReactNode {
  // 富文本段落（richParas）是格式化的格式来源；不存在时回退到纯文本段落（paras）
  if (cell.richParas && cell.richParas.length > 0) {
    return cell.richParas.map((para, paraIndex) => (
      <p key={paraIndex} className="word-table__cell-content">
        {para.runs.map((run, runIndex) => (
          <span key={runIndex} style={getRunStyle(run)}>
            {run.text}
          </span>
        ))}
      </p>
    ));
  }

  const paras = cell.paras;
  if (paras.length === 0) {
    return <p className="word-table__cell-content">&nbsp;</p>;
  }

  return paras.map((paraText, paraIndex) => (
    <p key={paraIndex} className="word-table__cell-content">
      {paraText}
    </p>
  ));
}

function renderImage(block: Block): React.ReactNode {
  if (!block.imageDataUrl) {
    return (
      <div className="word-image word-image--empty">
        {block.previewText || '[图片]'}
      </div>
    );
  }

  const imageStyle: React.CSSProperties = {
    maxWidth: '100%',
    display: 'block',
  };

  if (block.imageWidthPx) {
    imageStyle.width = `${block.imageWidthPx}px`;
  }
  if (block.imageHeightPx) {
    imageStyle.height = `${block.imageHeightPx}px`;
  }
  if (block.imageAlign === 'center') {
    imageStyle.marginLeft = 'auto';
    imageStyle.marginRight = 'auto';
  } else if (block.imageAlign === 'right') {
    imageStyle.marginLeft = 'auto';
  }

  return (
    <div className={`word-image word-image--wrapper word-image--align-${block.imageAlign || 'left'}`}>
      <img
        src={block.imageDataUrl}
        alt={block.label || '图片'}
        style={imageStyle}
        className="word-image"
      />
    </div>
  );
}

/**
 * 引擎 ParaAlign（w:jc）→ CSS text-align 显式映射。
 * 'justify'（两端对齐）与 'distribute'（分散对齐）在 HTML 中统一按 justify 呈现。
 */
function paraAlignToTextAlign(align: ParaAlign): React.CSSProperties['textAlign'] {
  switch (align) {
    case 'left':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    case 'justify':
    case 'distribute':
      return 'justify';
    default:
      return 'left';
  }
}

function getBlockStyle(block: Block, pageDimensions: PageDimensions, zoom: number): React.CSSProperties {
  const scale = zoom / 100;
  const style: React.CSSProperties = {
    fontSize: `${14 * scale}px`,
    lineHeight: 1.6,
  };

  if (block.format) {
    const format = block.format;

    if (format.align) {
      style.textAlign = paraAlignToTextAlign(format.align);
    }

    if (format.indentLeft) {
      style.paddingLeft = `${format.indentLeft * scale}px`;
    }
    if (format.indentRight) {
      style.paddingRight = `${format.indentRight * scale}px`;
    }

    if (format.spaceBefore) {
      style.marginTop = `${format.spaceBefore * scale}px`;
    }
    if (format.spaceAfter) {
      style.marginBottom = `${format.spaceAfter * scale}px`;
    }

    if (format.lineSpacing) {
      style.lineHeight = String(format.lineSpacing);
    }

    if (format.shadingFill) {
      style.backgroundColor = `#${format.shadingFill}`;
    }
  }

  if (block.type === 'heading' && block.level) {
    const headingSizes: Record<number, number> = {
      1: 32,
      2: 28,
      3: 24,
      4: 20,
      5: 18,
      6: 16,
      7: 14,
      8: 13,
      9: 12,
    };
    style.fontSize = `${(headingSizes[block.level] || 14) * scale}px`;
    style.fontWeight = 'bold';
  }

  return style;
}

function getRunStyle(run: Run): React.CSSProperties {
  const style: React.CSSProperties = {};

  if (run.bold) {
    style.fontWeight = 'bold';
  }
  if (run.italic) {
    style.fontStyle = 'italic';
  }
  if (run.underline) {
    style.textDecoration = 'underline';
  }
  if (run.strike) {
    style.textDecoration = 'line-through';
  }

  if (run.color) {
    style.color = `#${run.color}`;
  }

  if (run.sizeHalfPoints) {
    style.fontSize = `${run.sizeHalfPoints / 2}pt`;
  }

  if (run.font || run.fontAscii) {
    style.fontFamily = run.fontAscii || run.font || 'inherit';
  }

  if (run.highlight) {
    style.backgroundColor = getHighlightColor(run.highlight);
  }

  if (run.vertAlign === 'superscript') {
    style.verticalAlign = 'super';
    style.fontSize = '0.7em';
  } else if (run.vertAlign === 'subscript') {
    style.verticalAlign = 'sub';
    style.fontSize = '0.7em';
  }

  if (run.link) {
    style.color = '#1677ff';
    style.textDecoration = 'underline',
    style.cursor = 'pointer';
  }

  return style;
}

function getTableCellStyle(
  cell: TableCell,
  table: TableModel
): React.CSSProperties {
  const style: React.CSSProperties = {
    border: '1px solid #000',
    padding: '8px',
    verticalAlign: cell.vAlign || 'top',
  };

  if (cell.align) {
    style.textAlign = paraAlignToTextAlign(cell.align);
  }

  if (cell.fill) {
    style.backgroundColor = `#${cell.fill}`;
  }

  if (cell.color) {
    style.color = `#${cell.color}`;
  }

  if (cell.borders) {
    const { top, left, bottom, right } = cell.borders;
    style.borderTop = getBorderStyle(top);
    style.borderLeft = getBorderStyle(left);
    style.borderBottom = getBorderStyle(bottom);
    style.borderRight = getBorderStyle(right);
  }

  return style;
}

function getBorderStyle(border?: { style?: string; szEighths?: number; color?: string }): string {
  if (!border || border.style === 'none') {
    return 'none';
  }

  const width = border.szEighths ? border.szEighths / 8 : 1;
  const color = border.color ? `#${border.color}` : '#000';

  switch (border.style) {
    case 'single':
    case 'solid':
      return `${width}px solid ${color}`;
    case 'double':
      return `${width}px double ${color}`;
    case 'dashed':
      return `${width}px dashed ${color}`;
    case 'dotted':
      return `${width}px dotted ${color}`;
    default:
      return `${width}px solid ${color}`;
  }
}

function getHighlightColor(highlight: string): string {
  const colorMap: Record<string, string> = {
    yellow: '#ffff00',
    red: '#ff0000',
    green: '#00ff00',
    blue: '#0000ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    black: '#000000',
    white: '#ffffff',
    darkBlue: '#000080',
    darkCyan: '#008080',
    darkGreen: '#008000',
    darkMagenta: '#800080',
    darkRed: '#800000',
    darkYellow: '#808000',
    darkGray: '#808080',
    lightGray: '#c0c0c0',
  };

  return colorMap[highlight.toLowerCase()] || '#ffff00';
}

export default BlockRenderer;
