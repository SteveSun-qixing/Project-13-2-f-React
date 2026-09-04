/**
 * 界面文案定义
 * 所有界面文本统一使用简体中文直写
 */

/**
 * 通用文案
 */
export const messages = {
  // 应用名称
  appName: '薯片笔记',

  // 空状态
  empty: {
    noWorkspace: '还没有选择工作目录',
    selectWorkspace: '点击选择工作目录',
    noNotebook: '还没有笔记本',
    createFirst: '创建第一个笔记本开始记录',
    noNote: '还没有打开笔记',
    selectNote: '从左侧选择一个笔记',
    noContent: '开始书写吧',
    clickToEdit: '点击此处开始编辑',
  },

  // 笔记本
  notebook: {
    newNotebook: '新建笔记本',
    rename: '重命名',
    delete: '删除笔记本',
    confirmDelete: '确定要删除这个笔记本吗？',
    deleteWarning: '删除后笔记本中的所有笔记都将被删除，此操作不可恢复。',
    inputName: '请输入笔记本名称',
    defaultName: '我的笔记本',
  },

  // 笔记
  note: {
    newNote: '新建笔记',
    rename: '重命名',
    delete: '删除笔记',
    confirmDelete: '确定要删除这篇笔记吗？',
    deleteWarning: '此操作不可恢复。',
    inputTitle: '请输入笔记标题',
    defaultTitle: '无标题笔记',
  },

  // 编辑器
  editor: {
    untitled: '无标题',
    modified: '已修改',
    saved: '已保存',
    saving: '保存中...',
    saveFailed: '保存失败',
    loadFailed: '加载失败',
    retry: '重试',
  },

  // 工具栏
  toolbar: {
    bold: '加粗',
    italic: '斜体',
    strikethrough: '删除线',
    code: '行内代码',
    link: '链接',
    image: '图片',
    heading1: '标题1',
    heading2: '标题2',
    heading3: '标题3',
    bulletList: '无序列表',
    orderedList: '有序列表',
    quote: '引用',
    divider: '分割线',
  },

  // 对话框
  dialog: {
    ok: '确定',
    cancel: '取消',
    confirm: '确认',
    yes: '是',
    no: '否',
  },

  // 错误
  error: {
    workspaceNotFound: '工作目录不存在',
    notebookNotFound: '笔记本不存在',
    notebookLoadFailed: '加载笔记本内容失败',
    noteNotFound: '笔记不存在',
    loadFailed: '加载失败',
    saveFailed: '保存失败',
    unknown: '发生未知错误，请重试',
  },
} as const;
