import { recognize } from "tesseract.js";

export async function extractTextFromCapturedImage(
  imageDataUrl: string,
  onProgress?: (progress: number) => void
) {
  const result = await recognize(imageDataUrl, "eng", {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress?.(Math.round(message.progress * 100));
      }
    }
  });

  return result.data.text.trim();
}
