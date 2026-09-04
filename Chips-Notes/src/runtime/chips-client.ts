import { createClient, type Client } from 'chips-sdk';

let clientInstance: Client | null = null;

export function getEditingEngineClient(): Client {
  if (!clientInstance) {
    clientInstance = createClient();
  }

  return clientInstance;
}
