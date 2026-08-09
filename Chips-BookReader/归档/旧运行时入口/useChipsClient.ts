import { useState } from "react";
import { createClient, type Client } from "chips-sdk";
import { createSdkLogger, createTraceId } from "../../config/logging";

interface UseChipsClientResult {
  client: Client;
  traceId: string;
}

export function useChipsClient(): UseChipsClientResult {
  const [traceId] = useState(() => createTraceId("book-reader"));
  const [client] = useState<Client>(() =>
    createClient({
      logger: createSdkLogger({
        scope: "sdk",
        traceId,
      }),
    }),
  );

  return {
    client,
    traceId,
  };
}
