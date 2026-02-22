export const uploadFileToConvexStorage = (
  uploadUrl: string,
  file: File,
): Promise<{ storageId: string }> => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", uploadUrl, true);
    request.timeout = 130000;

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Upload fehlgeschlagen (${request.status}).`));
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
    request.send(file);
  });
};
