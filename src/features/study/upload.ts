const LOCAL_UPLOAD_PROXY_PATH = "/__smartnotes_dev__/upload";

const normalizeHostname = (hostname: string) => {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (normalizedHostname.startsWith("[") && normalizedHostname.endsWith("]")) {
    return normalizedHostname.slice(1, -1);
  }

  return normalizedHostname;
};

const isLocalDevelopmentHostname = (hostname: string) => {
  const normalizedHostname = normalizeHostname(hostname);

  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1"
  );
};

const resolveUploadRequest = (uploadUrl: string) => {
  if (!isLocalDevelopmentHostname(window.location.hostname)) {
    return { requestUrl: uploadUrl, isLocalProxied: false };
  }

  const proxiedUploadUrl = new URL(
    LOCAL_UPLOAD_PROXY_PATH,
    window.location.origin,
  );
  proxiedUploadUrl.searchParams.set("target", uploadUrl);
  return { requestUrl: proxiedUploadUrl.toString(), isLocalProxied: true };
};

const extractErrorText = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue || null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["reason", "message", "error", "detail"]) {
    const nestedValue = extractErrorText(record[key]);
    if (nestedValue) {
      return nestedValue;
    }
  }

  return null;
};

const getLocalProxyUploadErrorReason = (responseText: string) => {
  const trimmedResponse = responseText.trim();
  if (!trimmedResponse) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedResponse) as unknown;
    return extractErrorText(parsed) ?? trimmedResponse;
  } catch {
    return trimmedResponse;
  }
};

export const uploadFileToManagedStorage = (
  uploadUrl: string,
  file: File,
  options: {
    storageProvider: "convex" | "r2";
    presetStorageId: string | null;
  },
): Promise<{ storageId: string }> => {
  return new Promise((resolve, reject) => {
    const { requestUrl, isLocalProxied } = resolveUploadRequest(uploadUrl);
    const request = new XMLHttpRequest();
    request.open(
      options.storageProvider === "r2" ? "PUT" : "POST",
      requestUrl,
      true,
    );
    request.timeout = 130000;

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        const proxyErrorReason = isLocalProxied
          ? getLocalProxyUploadErrorReason(request.responseText ?? "")
          : null;
        const message = proxyErrorReason
          ? `Upload fehlgeschlagen (${request.status}): ${proxyErrorReason}`
          : `Upload fehlgeschlagen (${request.status}).`;
        reject(new Error(message));
        return;
      }

      if (options.storageProvider === "r2") {
        if (!options.presetStorageId) {
          reject(new Error("R2-Upload hat keine storageId geliefert."));
          return;
        }
        resolve({ storageId: options.presetStorageId });
        return;
      }

      const responseText = request.responseText ?? "";
      try {
        const parsed = JSON.parse(responseText) as { storageId?: string };
        if (!parsed.storageId) {
          throw new Error("storageId fehlt");
        }
        resolve({ storageId: parsed.storageId });
      } catch {
        const match = responseText.match(/"storageId"\s*:\s*"([^"]+)"/);
        if (match?.[1]) {
          resolve({ storageId: match[1] });
          return;
        }
        reject(new Error("Upload-Antwort konnte nicht gelesen werden."));
      }
    };

    request.onerror = () => reject(new Error("Netzwerkfehler beim Hochladen."));
    request.ontimeout = () =>
      reject(new Error("Zeitüberschreitung beim Hochladen."));
    request.onabort = () => reject(new Error("Upload abgebrochen."));
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    request.send(file);
  });
};
