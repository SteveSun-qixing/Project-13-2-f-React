import React from 'react';
import { useParams } from 'react-router-dom';
import { HostedPluginSurface } from '../components/HostedPluginSurface';

export default function HostedPluginSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  if (!sessionId) {
    return null;
  }

  return <HostedPluginSurface sessionId={sessionId} />;
}
