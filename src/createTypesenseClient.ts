import { Client as TypesenseClient } from "typesense";
import { TypesenseConfig } from "./typesense.types";

export const createTypesenseClient = (config: TypesenseConfig) => {
  let url: URL;
  try {
    url = new URL(config.url);
  } catch (error) {
    throw new Error("Invalid Typesense URL");
  }
  const client = new TypesenseClient({
    apiKey: config.apiKey,
    nodes: [
      {
        host: url.hostname,
        port: parseInt(url.port) || 443,
        protocol: url.protocol.replace(":", ""),
      },
    ],
    sendApiKeyAsQueryParam: true,
    connectionTimeoutSeconds: 2,
  });
  return client;
};
