import { franc } from "franc";
import langs from "langs";

export type DetectedLanguage = {
  iso6393: string;
  iso6391: string | null;
  languageName: string;
};

const MIN_TEXT_LENGTH = 20;

export function detectContractLanguage(text: string): DetectedLanguage {
  if (text.trim().length < MIN_TEXT_LENGTH) {
    return {
      iso6393: "und",
      iso6391: null,
      languageName: "Unknown"
    };
  }

  const iso6393 = franc(text, { minLength: MIN_TEXT_LENGTH });

  if (iso6393 === "und") {
    return {
      iso6393: "und",
      iso6391: null,
      languageName: "Unknown"
    };
  }

  const language = langs.where("3", iso6393) as
    | { [key: string]: string | undefined }
    | undefined;

  return {
    iso6393,
    iso6391: language?.["1"] ?? null,
    languageName: language?.name ?? "Unknown"
  };
}
