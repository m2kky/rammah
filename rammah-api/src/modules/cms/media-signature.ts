import { fileTypeFromBuffer } from "file-type";

export type DetectedMedia = {
  mediaKind: "image" | "video" | "animation_bundle";
  mimeType: string;
};

const mediaKindByMimeType: Record<string, DetectedMedia["mediaKind"]> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "application/zip": "animation_bundle",
};

export const detectAllowedMedia = async (
  bytes: Uint8Array,
  declaredType: string,
): Promise<DetectedMedia> => {
  const normalizedDeclaredType = declaredType.split(";", 1)[0]!.trim().toLowerCase();
  if (normalizedDeclaredType === "image/svg+xml") {
    throw new Error("SVG uploads are not supported.");
  }
  const declaredKind = mediaKindByMimeType[normalizedDeclaredType];
  if (!declaredKind) {
    throw new Error(`Unsupported media MIME type: ${normalizedDeclaredType || "unknown"}.`);
  }

  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || detected.mime !== normalizedDeclaredType) {
    throw new Error("File signature does not match the declared media type.");
  }

  const detectedKind = mediaKindByMimeType[detected.mime];
  if (!detectedKind || detectedKind !== declaredKind) {
    throw new Error("File signature is not an allowed media type.");
  }

  return { mediaKind: detectedKind, mimeType: detected.mime };
};
