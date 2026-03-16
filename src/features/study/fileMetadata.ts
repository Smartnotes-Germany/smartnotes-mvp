const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

export const computeUploadMetadata = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return {
    size: file.size,
    sha256: bytesToBase64(new Uint8Array(digest)),
    contentType: file.type || null,
  };
};
