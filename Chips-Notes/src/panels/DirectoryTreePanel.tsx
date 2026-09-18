import React, { useState, useEffect } from 'react';
import { Tree, Button, Dropdown, Input, Modal, message, Spin } from 'antd';
import type { TreeDataNode, TreeProps } from 'antd';
import {
  FolderOutlined,
  FileTextOutlined,
  PlusOutlined,
  MoreOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useNotebook } from '../context/NotebookContext';
import { useNote } from '../context/NoteContext';

interface NoteTreeNode extends TreeDataNode {
  type: 'root' | 'notebook' | 'note';
  path?: string;
}

export function DirectoryTreePanel(): React.ReactElement {
  const {
    treeData: contextTreeData,
    loading,
    selectedKey,
    expandedKeys: contextExpandedKeys,
    createNotebook,
    deleteNotebook,
    renameNotebook,
    createNote,
    deleteNote,
    renameNote,
    selectNode,
    setExpandedKeys: setContextExpandedKeys,
  } = useNotebook();

  const { openNote } = useNote();

  const [treeData, setTreeData] = useState<NoteTreeNode[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['root']);

  useEffect(() => {
    const converted: NoteTreeNode[] = [
      {
        title: '工作区',
        key: 'root',
        type: 'root',
        icon: <FolderOutlined />,
        children: contextTreeData.map(node => ({
          title: node.title,
          key: node.key,
          type: node.type as 'notebook' | 'note',
          path: node.path,
          icon: node.type === 'notebook' ? <FolderOutlined /> : <FileTextOutlined />,
          children: node.children?.map(child => ({
            title: child.title,
            key: child.key,
            type: 'note' as const,
            path: child.path,
            icon: <FileTextOutlined />,
            isLeaf: true,
          })),
        })),
      },
    ];
    setTreeData(converted);
  }, [contextTreeData]);

  useEffect(() => {
    if (selectedKey) {
      setSelectedKeys([selectedKey]);
    }
  }, [selectedKey]);

  useEffect(() => {
    setExpandedKeys(['root', ...contextExpandedKeys]);
  }, [contextExpandedKeys]);

  const getContextMenu = (node: NoteTreeNode): MenuProps['items'] => {
    if (node.type === 'root' || node.type === 'notebook') {
      return [
        {
          key: 'new-notebook',
          label: '新建笔记本',
          icon: <FolderOutlined />,
          onClick: () => handleCreateNotebook(node),
        },
        {
          key: 'new-note',
          label: '新建笔记',
          icon: <FileTextOutlined />,
          onClick: () => handleCreateNote(node),
        },
        { type: 'divider' },
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => handleRename(node),
          disabled: node.type === 'root',
        },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => handleDelete(node),
          disabled: node.type === 'root',
        },
      ];
    } else {
      return [
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => handleRename(node),
        },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => handleDelete(node),
        },
      ];
    }
  };

  const handleCreateNotebook = (parentNode: NoteTreeNode) => {
    let inputValue = '';
    const modal = Modal.confirm({
      title: '新建笔记本',
      content: (
        <Input
          placeholder="请输入笔记本名称"
          autoFocus
          onChange={(e) => {
            inputValue = e.target.value;
          }}
          onPressEnter={async () => {
            if (inputValue.trim()) {
              try {
                await createNotebook(inputValue.trim());
                message.success(`笔记本创建成功: ${inputValue}`);
                modal.destroy();
              } catch (error) {
                message.error(`创建失败: ${error}`);
              }
            }
          }}
        />
      ),
      onOk: async () => {
        if (inputValue.trim()) {
          try {
            await createNotebook(inputValue.trim());
            message.success(`笔记本创建成功: ${inputValue}`);
          } catch (error) {
            message.error(`创建失败: ${error}`);
          }
        }
      },
    });
  };

  const handleCreateNote = (parentNode: NoteTreeNode) => {
    let inputValue = '';
    const notebookPath = parentNode.type === 'notebook' ? parentNode.path : undefined;

    const modal = Modal.confirm({
      title: '新建笔记',
      content: (
        <Input
          placeholder="请输入笔记名称"
          autoFocus
          onChange={(e) => {
            inputValue = e.target.value;
          }}
          onPressEnter={async () => {
            if (inputValue.trim()) {
              try {
                await createNote(inputValue.trim(), notebookPath);
                message.success(`笔记创建成功: ${inputValue}`);
                modal.destroy();
              } catch (error) {
                message.error(`创建失败: ${error}`);
              }
            }
          }}
        />
      ),
      onOk: async () => {
        if (inputValue.trim()) {
          try {
            await createNote(inputValue.trim(), notebookPath);
            message.success(`笔记创建成功: ${inputValue}`);
          } catch (error) {
            message.error(`创建失败: ${error}`);
          }
        }
      },
    });
  };

  const handleRename = (node: NoteTreeNode) => {
    let inputValue = node.title as string;
    const modal = Modal.confirm({
      title: '重命名',
      content: (
        <Input
          placeholder="请输入新名称"
          defaultValue={node.title as string}
          autoFocus
          onChange={(e) => {
            inputValue = e.target.value;
          }}
          onPressEnter={async () => {
            if (inputValue.trim() && node.path) {
              try {
                if (node.type === 'notebook') {
                  await renameNotebook(node.key as string, node.path, inputValue.trim());
                } else {
                  await renameNote(node.key as string, node.path, inputValue.trim());
                }
                message.success('重命名成功');
                modal.destroy();
              } catch (error) {
                message.error(`重命名失败: ${error}`);
              }
            }
          }}
        />
      ),
      onOk: async () => {
        if (inputValue.trim() && node.path) {
          try {
            if (node.type === 'notebook') {
              await renameNotebook(node.key as string, node.path, inputValue.trim());
            } else {
              await renameNote(node.key as string, node.path, inputValue.trim());
            }
            message.success('重命名成功');
          } catch (error) {
            message.error(`重命名失败: ${error}`);
          }
        }
      },
    });
  };

  const handleDelete = (node: NoteTreeNode) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除"${node.title}"吗？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        if (node.path) {
          try {
            if (node.type === 'notebook') {
              await deleteNotebook(node.key as string, node.path);
            } else {
              await deleteNote(node.key as string, node.path);
            }
            message.success('删除成功');
          } catch (error) {
            message.error(`删除失败: ${error}`);
          }
        }
      },
    });
  };

  const onSelect: TreeProps['onSelect'] = async (selectedKeysValue, info) => {
    setSelectedKeys(selectedKeysValue);
    const node = info.node as NoteTreeNode;

    if (node.type === 'note' && node.path) {
      selectNode(node.key as string);
      try {
        await openNote(node.path);
      } catch (error) {
        message.error(`打开笔记失败: ${error}`);
      }
    } else if (node.type === 'notebook') {
      selectNode(node.key as string);
    }
  };

  const onExpand: TreeProps['onExpand'] = (expandedKeysValue) => {
    const filtered = expandedKeysValue.filter(key => key !== 'root');
    setExpandedKeys(expandedKeysValue);
    setContextExpandedKeys(filtered as string[]);
  };

  const titleRender = (node: NoteTreeNode) => {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <span>{node.title}</span>
        <Dropdown
          menu={{ items: getContextMenu(node) }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            onClick={(e) => e.stopPropagation()}
            style={{ opacity: 0.6 }}
          />
        </Dropdown>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 8 }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleCreateNote(treeData[0])}
          block
        >
          新建笔记
        </Button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Tree
          showLine
          showIcon
          selectedKeys={selectedKeys}
          expandedKeys={expandedKeys}
          onSelect={onSelect}
          onExpand={onExpand}
          treeData={treeData}
          titleRender={titleRender}
        />
      </div>
    </div>
  );
}
