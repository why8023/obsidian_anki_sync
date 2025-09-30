import type { TFile } from 'obsidian';

export interface FlashcardSettings {
  /**
   * 在笔记中标识闪卡的字符串，例如 `ANKI`。
   */
  flashcardMarker: string;
  /**
   * 同步到 Anki 时使用的最顶层牌组名称。
   */
  deckRootName: string;
  /**
   * AnkiConnect 服务的访问地址。
   */
  ankiConnectUrl: string;
}

export interface StoredCardReference {
  noteId: number;
  file: string;
  line: number;
}

export interface PluginData {
  settings: FlashcardSettings;
  cards: Record<string, StoredCardReference>;
}

export const DEFAULT_SETTINGS: FlashcardSettings = {
  flashcardMarker: 'ANKI',
  deckRootName: 'Obsidian',
  ankiConnectUrl: 'http://127.0.0.1:8765',
};

export function createDefaultData(): PluginData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    cards: {},
  };
}

export function isMarkdownFile(file: TFile | null | undefined): file is TFile {
  return !!file && file.extension === 'md';
}
