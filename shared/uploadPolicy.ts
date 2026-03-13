export const MAX_UPLOAD_FILE_BYTES = 7 * 1024 * 1024;
export const MAX_UPLOAD_FILE_LABEL = "7 MiB";

export const ACCEPTED_UPLOAD_EXTENSIONS = [
  "pdf",
  "ppt",
  "pptx",
  "doc",
  "docx",
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export const VERTEX_NATIVE_UPLOAD_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export const VERTEX_NATIVE_UPLOAD_MEDIA_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ACCEPTED_FILE_TYPES = ACCEPTED_UPLOAD_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(",");

export const ACCEPTED_FILE_TYPES_LABEL =
  "PDF, PPT/PPTX, DOC/DOCX, TXT, MD, CSV, JSON, JPG/JPEG, PNG, WEBP";

type UploadFileLike = {
  name: string;
  size: number;
};

const extensionPattern = /\.([a-z0-9]+)$/i;

export const getFileExtension = (fileName: string) => {
  const match = fileName.match(extensionPattern);
  return match?.[1]?.toLowerCase() ?? "";
};

export const isAcceptedUploadFileName = (fileName: string) => {
  const extension = getFileExtension(fileName);
  return ACCEPTED_UPLOAD_EXTENSIONS.includes(
    extension as (typeof ACCEPTED_UPLOAD_EXTENSIONS)[number],
  );
};

export const formatFileSizeMiB = (sizeBytes: number) => {
  const value = sizeBytes / (1024 * 1024);
  return `${value.toFixed(1)} MiB`;
};

export const validateUploadFile = (file: UploadFileLike) => {
  if (!isAcceptedUploadFileName(file.name)) {
    return {
      valid: false,
      message:
        "Dieser Dateityp wird nicht unterstützt. Bitte nutze eines der erlaubten Formate.",
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      valid: false,
      message: "Die Datei ist leer oder konnte nicht korrekt gelesen werden.",
    };
  }

  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    return {
      valid: false,
      message: `Die Datei ist mit ${formatFileSizeMiB(file.size)} zu groß (maximal ${MAX_UPLOAD_FILE_LABEL}).`,
    };
  }

  return {
    valid: true,
    message: null,
  } as const;
};

const vertexNativeUploadExtensionSet = new Set<string>(
  VERTEX_NATIVE_UPLOAD_EXTENSIONS,
);
const vertexNativeUploadMediaTypeSet = new Set<string>(
  VERTEX_NATIVE_UPLOAD_MEDIA_TYPES,
);

export const isVertexNativeCandidate = (fileType: string, fileName: string) => {
  const extension = getFileExtension(fileName);
  return (
    vertexNativeUploadMediaTypeSet.has(fileType) ||
    vertexNativeUploadExtensionSet.has(extension)
  );
};
