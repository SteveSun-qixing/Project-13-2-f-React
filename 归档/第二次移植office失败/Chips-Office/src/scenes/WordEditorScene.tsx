import React, { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { useAppRuntime } from '../app/AppRuntimeProvider';
import { WordEditor } from '../apps/word/WordEditor';
import { formatMessage } from '../lib/messages';

export function WordEditorScene() {
  const { client, launchContext } = useAppRuntime();
  const [docxBytes, setDocxBytes] = useState<Uint8Array | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('未命名.docx');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    async function loadDocument() {
      if (!client) return;

      const params = launchContext?.launchParams;
      const resourceOpen = params?.resourceOpen as {
        resourceId?: string;
        filePath?: string;
        fileName?: string;
        intent?: string;
      } | undefined;

      if (resourceOpen?.filePath) {
        try {
          const filePath = resourceOpen.filePath;
          setFilePath(filePath);
          setFileName(resourceOpen.fileName || filePath.split('/').pop() || '文档.docx');

          const intent = resourceOpen.intent || 'view';
          setReadOnly(intent === 'view');

          const officeApi = (client as any).office?.document;
          if (officeApi) {
            const descriptor = await officeApi.open({ filePath });
            setSessionId(descriptor.sessionId);

            const { document, bytes } = await officeApi.read(descriptor.sessionId);
            setDocxBytes(bytes);
          } else {
            const bytes = await client.file.read(filePath, { encoding: 'binary' });
            setDocxBytes(bytes as unknown as Uint8Array);
          }
        } catch (err) {
          console.error('Failed to load document:', err);
          message.error('文档加载失败');
        }
      }
    }

    loadDocument();
  }, [client, launchContext]);

  const handleSave = useCallback(
    async (bytes: Uint8Array) => {
      if (!client) return;

      const targetPath = filePath || fileName;

      if (sessionId) {
        const officeApi = (client as any).office?.document;
        if (officeApi) {
          await officeApi.write(sessionId, bytes);
          await officeApi.persist(sessionId);
          message.success('文档已保存');
        }
      } else {
        await client.file.write(targetPath, bytes);
        message.success('文档已保存');
      }
    },
    [client, sessionId, filePath, fileName]
  );

  const handleClose = useCallback(() => {
    if (!client || !sessionId) return;

    const officeApi = (client as any).office?.document;
    if (officeApi) {
      officeApi.close(sessionId).catch(console.error);
    }
  }, [client, sessionId]);

  return (
    <WordEditor
      initialBytes={docxBytes || undefined}
      filePath={filePath || undefined}
      fileName={fileName}
      readOnly={readOnly}
      client={client as any}
      sessionId={sessionId || undefined}
      onSave={handleSave}
      onClose={handleClose}
    />
  );
}

export default WordEditorScene;
