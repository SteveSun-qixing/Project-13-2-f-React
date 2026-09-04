import { describe, it, expect } from 'vitest';
import { formatMessage } from '../../src/apps/word/lib/messages';

describe('formatMessage', () => {
  describe('基础功能', () => {
    it('应返回已存在的消息', () => {
      const result = formatMessage('word.editor.title');
      expect(result).toBe('Word 编辑器');
    });

    it('应返回键名当消息不存在时', () => {
      const result = formatMessage('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('应返回空字符串当键为空时', () => {
      const result = formatMessage('');
      expect(result).toBe('');
    });
  });

  describe('参数替换', () => {
    it('应正确替换单个参数', () => {
      const result = formatMessage('word.statusBar.page', {
        current: 1,
        total: 10,
      });
      expect(result).toBe('第 1 页，共 10 页');
    });

    it('应正确替换多个参数', () => {
      const result = formatMessage('word.statusBar.words', {
        count: 1234,
      });
      expect(result).toBe('1234 字');
    });

    it('应处理数字参数', () => {
      const result = formatMessage('word.statusBar.zoom', {
        percent: 150,
      });
      expect(result).toBe('缩放 150%');
    });

    it('应处理字符串参数', () => {
      const result = formatMessage('word.statusBar.page', {
        current: '5',
        total: '20',
      });
      expect(result).toBe('第 5 页，共 20 页');
    });

    it('当参数缺失时应保留占位符', () => {
      const result = formatMessage('word.statusBar.page', {
        current: 1,
      });
      expect(result).toBe('第 1 页，共 {total} 页');
    });

    it('当参数多余时应忽略额外参数', () => {
      const result = formatMessage('word.editor.title', {
        extra: 'ignored',
      });
      expect(result).toBe('Word 编辑器');
    });

    it('应正确处理空参数对象', () => {
      const result = formatMessage('word.editor.title', {});
      expect(result).toBe('Word 编辑器');
    });
  });

  describe('工具栏消息', () => {
    it('应返回所有工具栏消息', () => {
      expect(formatMessage('word.toolbar.bold')).toBe('加粗');
      expect(formatMessage('word.toolbar.italic')).toBe('斜体');
      expect(formatMessage('word.toolbar.underline')).toBe('下划线');
      expect(formatMessage('word.toolbar.strikethrough')).toBe('删除线');
    });

    it('应返回字体相关消息', () => {
      expect(formatMessage('word.toolbar.font')).toBe('字体');
      expect(formatMessage('word.toolbar.fontSize')).toBe('字号');
      expect(formatMessage('word.toolbar.textColor')).toBe('文字颜色');
      expect(formatMessage('word.toolbar.highlight')).toBe('背景颜色');
    });

    it('应返回对齐相关消息', () => {
      expect(formatMessage('word.toolbar.alignLeft')).toBe('左对齐');
      expect(formatMessage('word.toolbar.alignCenter')).toBe('居中对齐');
      expect(formatMessage('word.toolbar.alignRight')).toBe('右对齐');
      expect(formatMessage('word.toolbar.alignJustify')).toBe('两端对齐');
    });

    it('应返回列表相关消息', () => {
      expect(formatMessage('word.toolbar.orderedList')).toBe('编号列表');
      expect(formatMessage('word.toolbar.unorderedList')).toBe('项目符号列表');
    });

    it('应返回标题级别消息', () => {
      expect(formatMessage('word.toolbar.heading1')).toBe('标题 1');
      expect(formatMessage('word.toolbar.heading2')).toBe('标题 2');
      expect(formatMessage('word.toolbar.heading3')).toBe('标题 3');
    });
  });

  describe('状态栏消息', () => {
    it('应返回只读模式消息', () => {
      expect(formatMessage('word.statusBar.readOnly')).toBe('只读模式');
    });

    it('应返回编辑模式消息', () => {
      expect(formatMessage('word.statusBar.editMode')).toBe('编辑模式');
    });
  });

  describe('批注消息', () => {
    it('应返回批注面板标题', () => {
      expect(formatMessage('word.comment.title')).toBe('批注');
    });

    it('应返回批注操作消息', () => {
      expect(formatMessage('word.comment.add')).toBe('添加批注');
      expect(formatMessage('word.comment.reply')).toBe('回复');
      expect(formatMessage('word.comment.delete')).toBe('删除');
      expect(formatMessage('word.comment.resolve')).toBe('标记为已解决');
    });

    it('应返回批注占位符', () => {
      expect(formatMessage('word.comment.placeholder')).toBe('输入批注内容...');
    });

    it('应返回空批注消息', () => {
      expect(formatMessage('word.comment.empty')).toBe('暂无批注');
    });
  });

  describe('对话框消息', () => {
    it('应返回对话框按钮消息', () => {
      expect(formatMessage('word.dialog.confirm')).toBe('确认');
      expect(formatMessage('word.dialog.cancel')).toBe('取消');
      expect(formatMessage('word.dialog.save')).toBe('保存');
    });
  });

  describe('表格消息', () => {
    it('应返回表格尺寸消息', () => {
      expect(formatMessage('word.table.size')).toBe('表格尺寸');
      expect(formatMessage('word.table.rows')).toBe('行数');
      expect(formatMessage('word.table.columns')).toBe('列数');
    });

    it('应返回表格操作消息', () => {
      expect(formatMessage('word.table.insertRow')).toBe('插入行');
      expect(formatMessage('word.table.insertColumn')).toBe('插入列');
      expect(formatMessage('word.table.deleteRow')).toBe('删除行');
      expect(formatMessage('word.table.deleteColumn')).toBe('删除列');
    });
  });

  describe('图片消息', () => {
    it('应返回图片插入消息', () => {
      expect(formatMessage('word.image.title')).toBe('插入图片');
      expect(formatMessage('word.image.selectFile')).toBe('选择文件');
    });

    it('应返回拖放提示', () => {
      expect(formatMessage('word.image.dragHint')).toBe('或拖放图片到此处');
    });

    it('应返回不支持格式消息', () => {
      expect(formatMessage('word.image.unsupported')).toBe('不支持的图片格式');
    });
  });

  describe('资源打开消息', () => {
    it('应返回资源打开错误消息', () => {
      expect(formatMessage('word.open.fileNotFound')).toBe('文件不存在');
      expect(formatMessage('word.open.parseError')).toBe('文档解析失败');
      expect(formatMessage('word.open.unsupportedFormat')).toBe('不支持的文档格式');
    });
  });

  describe('边界情况', () => {
    it('应处理特殊字符在参数值中', () => {
      const result = formatMessage('word.statusBar.words', {
        count: 100,
      });
      expect(result).toBe('100 字');
    });

    it('应处理参数值为 0', () => {
      const result = formatMessage('word.statusBar.words', {
        count: 0,
      });
      expect(result).toBe('0 字');
    });

    it('应处理参数值为负数', () => {
      const result = formatMessage('word.statusBar.words', {
        count: -10,
      });
      expect(result).toBe('-10 字');
    });

    it('应处理参数值为浮点数', () => {
      const result = formatMessage('word.statusBar.zoom', {
        percent: 75.5,
      });
      expect(result).toBe('缩放 75.5%');
    });
  });
});
