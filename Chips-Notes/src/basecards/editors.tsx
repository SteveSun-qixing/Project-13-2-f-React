/**
 * 基础卡片编辑面板组件库
 * @module basecards/editors
 * @description 提供所有基础卡片类型的编辑面板组件
 */

import React, { useState } from 'react';
import { Input, Button, Upload, Select, InputNumber, message } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

const { TextArea } = Input;

interface EditorProps {
  config: any;
  onChange: (config: any) => void;
  baseCardId: string;
  cardPath: string;
}

/**
 * 富文本卡片编辑器
 * 提供 HTML 内容编辑功能
 */
export function RichTextEditor({ config, onChange }: EditorProps): React.ReactElement {
  const [content, setContent] = useState<string>(
    (config?.content as string) || '<p></p>'
  );

  const handleChange = (newContent: string) => {
    setContent(newContent);
    onChange({ content: newContent });
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 500 }}>
        富文本内容（HTML）
      </div>
      <TextArea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        autoSize={{ minRows: 6, maxRows: 20 }}
        placeholder="请输入 HTML 内容..."
        style={{ fontFamily: 'monospace', fontSize: 13 }}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
        支持标准 HTML 标签，如 &lt;p&gt;、&lt;b&gt;、&lt;i&gt;、&lt;a&gt; 等
      </div>
    </div>
  );
}

/**
 * 图片卡片编辑器
 */
export function ImageEditor({ config, onChange, cardPath }: EditorProps): React.ReactElement {
  const [src, setSrc] = useState<string>((config?.src as string) || '');
  const [alt, setAlt] = useState<string>((config?.alt as string) || '');

  const handleSrcChange = (newSrc: string) => {
    setSrc(newSrc);
    onChange({ src: newSrc, alt });
  };

  const handleAltChange = (newAlt: string) => {
    setAlt(newAlt);
    onChange({ src, alt: newAlt });
  };

  const handleUpload = async (file: File) => {
    try {
      // 实现图片上传逻辑
      message.info('正在导入图片资源...');
      // 这里应该调用 SDK 的资源导入接口
      const fakePath = `resources/${file.name}`;
      setSrc(fakePath);
      onChange({ src: fakePath, alt });
      message.success('图片导入成功');
    } catch (error) {
      message.error(`上传失败: ${error}`);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          图片资源路径
        </label>
        <Input
          value={src}
          onChange={(e) => handleSrcChange(e.target.value)}
          placeholder="例如: resources/image.png"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          替代文本（alt）
        </label>
        <Input
          value={alt}
          onChange={(e) => handleAltChange(e.target.value)}
          placeholder="图片描述"
        />
      </div>
      <Upload beforeUpload={(file) => { handleUpload(file); return false; }} maxCount={1}>
        <Button icon={<UploadOutlined />}>上传图片</Button>
      </Upload>
      {src && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: 200 }} />
        </div>
      )}
    </div>
  );
}

/**
 * 视频卡片编辑器
 */
export function VideoEditor({ config, onChange }: EditorProps): React.ReactElement {
  const [src, setSrc] = useState<string>((config?.src as string) || '');
  const [poster, setPoster] = useState<string>((config?.poster as string) || '');

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          视频资源路径
        </label>
        <Input
          value={src}
          onChange={(e) => { setSrc(e.target.value); onChange({ src: e.target.value, poster }); }}
          placeholder="例如: resources/video.mp4"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          封面图路径
        </label>
        <Input
          value={poster}
          onChange={(e) => { setPoster(e.target.value); onChange({ src, poster: e.target.value }); }}
          placeholder="可选：视频封面"
        />
      </div>
    </div>
  );
}

/**
 * 音频卡片编辑器
 */
export function AudioEditor({ config, onChange }: EditorProps): React.ReactElement {
  const [src, setSrc] = useState<string>((config?.src as string) || '');
  const [title, setTitle] = useState<string>((config?.title as string) || '');

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          音频资源路径
        </label>
        <Input
          value={src}
          onChange={(e) => { setSrc(e.target.value); onChange({ src: e.target.value, title }); }}
          placeholder="例如: resources/audio.mp3"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          标题
        </label>
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); onChange({ src, title: e.target.value }); }}
          placeholder="音频标题"
        />
      </div>
    </div>
  );
}

/**
 * 网页卡片编辑器
 */
export function WebpageEditor({ config, onChange }: EditorProps): React.ReactElement {
  const [url, setUrl] = useState<string>((config?.url as string) || '');
  const [title, setTitle] = useState<string>((config?.title as string) || '');

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          网页 URL
        </label>
        <Input
          value={url}
          onChange={(e) => { setUrl(e.target.value); onChange({ url: e.target.value, title }); }}
          placeholder="https://example.com"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          显示标题（可选）
        </label>
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); onChange({ url, title: e.target.value }); }}
          placeholder="网页标题"
        />
      </div>
    </div>
  );
}

/**
 * 文件卡片编辑器
 */
export function FileEditor({ config, onChange }: EditorProps): React.ReactElement {
  const [path, setPath] = useState<string>((config?.path as string) || '');
  const [name, setName] = useState<string>((config?.name as string) || '');

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          文件路径
        </label>
        <Input
          value={path}
          onChange={(e) => { setPath(e.target.value); onChange({ path: e.target.value, name }); }}
          placeholder="例如: resources/document.pdf"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          显示名称
        </label>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); onChange({ path, name: e.target.value }); }}
          placeholder="文件名"
        />
      </div>
    </div>
  );
}

/**
 * 表格卡片编辑器
 */
export function TableEditor({ config, onChange }: EditorProps): React.ReactElement {
  const [rows, setRows] = useState<number>(config?.rows as number || 3);
  const [columns, setColumns] = useState<number>(config?.columns as number || 3);
  const [data, setData] = useState<any[][]>(
    (config?.data as any[][]) || Array(rows).fill(null).map(() => Array(columns).fill(''))
  );

  const updateDimensions = (newRows: number, newCols: number) => {
    const newData: any[][] = [];
    for (let i = 0; i < newRows; i++) {
      const existingRow = data[i] || [];
      const newRow: any[] = [];
      for (let j = 0; j < newCols; j++) {
        newRow.push(existingRow[j] || '');
      }
      newData.push(newRow);
    }
    setRows(newRows);
    setColumns(newCols);
    setData(newData);
    onChange({ rows: newRows, columns: newCols, data: newData });
  };

  const updateCell = (row: number, col: number, value: string) => {
    const newData = data.map((r, ri) =>
      ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r
    );
    setData(newData);
    onChange({ rows, columns, data: newData });
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>行数</label>
          <InputNumber min={1} max={20} value={rows} onChange={(v) => v && updateDimensions(v, columns)} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>列数</label>
          <InputNumber min={1} max={10} value={columns} onChange={(v) => v && updateDimensions(rows, v)} />
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ border: '1px solid #d9d9d9', padding: 0 }}>
                  <Input
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                    bordered={false}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 代码卡片编辑器
 */
export function CodeEditor({ config, onChange }: EditorProps): React.ReactElement {
  const [code, setCode] = useState<string>((config?.code as string) || '');
  const [language, setLanguage] = useState<string>((config?.language as string) || 'javascript');

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          编程语言
        </label>
        <Select
          value={language}
          onChange={(v) => { setLanguage(v); onChange({ code, language: v }); }}
          style={{ width: 200 }}
          options={[
            { value: 'javascript', label: 'JavaScript' },
            { value: 'typescript', label: 'TypeScript' },
            { value: 'python', label: 'Python' },
            { value: 'java', label: 'Java' },
            { value: 'cpp', label: 'C++' },
            { value: 'go', label: 'Go' },
            { value: 'rust', label: 'Rust' },
            { value: 'html', label: 'HTML' },
            { value: 'css', label: 'CSS' },
            { value: 'json', label: 'JSON' },
            { value: 'markdown', label: 'Markdown' },
            { value: 'shell', label: 'Shell' },
          ]}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          代码内容
        </label>
        <TextArea
          value={code}
          onChange={(e) => { setCode(e.target.value); onChange({ code: e.target.value, language }); }}
          autoSize={{ minRows: 8, maxRows: 24 }}
          placeholder="在此输入代码..."
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </div>
    </div>
  );
}

/**
 * 基础卡片编辑器路由
 * 根据卡片类型返回对应的编辑器
 */
export function BaseCardEditor(props: EditorProps & { cardType: string }): React.ReactElement {
  const { cardType } = props;

  switch (cardType) {
    case 'chips.basecard.rich-text':
      return <RichTextEditor {...props} />;
    case 'chips.basecard.image':
      return <ImageEditor {...props} />;
    case 'chips.basecard.video':
      return <VideoEditor {...props} />;
    case 'chips.basecard.audio':
      return <AudioEditor {...props} />;
    case 'chips.basecard.webpage':
      return <WebpageEditor {...props} />;
    case 'chips.basecard.file':
      return <FileEditor {...props} />;
    case 'chips.basecard.table':
      return <TableEditor {...props} />;
    case 'chips.basecard.code':
      return <CodeEditor {...props} />;
    default:
      return (
        <div style={{ padding: 16, color: '#999' }}>
          未知的基础卡片类型: {cardType}
        </div>
      );
  }
}
