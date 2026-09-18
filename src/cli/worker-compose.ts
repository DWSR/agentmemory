import { join } from "node:path";

export interface WorkerComposeOptions {
  dataDir: string;
  httpHost: string;
  restPort: number;
}

function yamlSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function workerComposeRuntimePath(dataDir: string): string {
  return join(dataDir, "worker-compose.runtime.yaml");
}

export function renderWorkerCompose(
  template: string,
  options: WorkerComposeOptions,
): string {
  return template
    .replaceAll("__AGENTMEMORY_STATE_PATH__", yamlSingleQuote(join(options.dataDir, "state_store.db")))
    .replaceAll("__AGENTMEMORY_HTTP_HOST__", yamlSingleQuote(options.httpHost))
    .replaceAll("__AGENTMEMORY_REST_PORT__", String(options.restPort));
}
