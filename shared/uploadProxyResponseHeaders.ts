const blockedUploadProxyResponseHeaders = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
]);

export const shouldForwardUploadProxyResponseHeader = (key: string) =>
  !blockedUploadProxyResponseHeaders.has(key.toLowerCase());
