import { App, MarkdownRenderer, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { AnkiClient } from './src/anki';
import { extractFlashcards, type FlashcardDefinition } from './src/parser';
import {
  DEFAULT_SETTINGS,
  type FlashcardSettings,
  type PluginData,
  type StoredCardReference,
  createDefaultData,
  isMarkdownFile,
} from './src/settings';
import {
  buildBreadcrumb,
  buildDeckName,
  computeCardId,
  createObsidianLink,
  escapeHtml,
  sanitizePathForTag,
} from './src/utils';

interface SyncResult {
  added: number;
  updated: number;
  errors: string[];
}

export default class ObsidianAnkiSyncPlugin extends Plugin {
  settings: FlashcardSettings = { ...DEFAULT_SETTINGS };
  private cards: Record<string, StoredCardReference> = {};
  private anki: AnkiClient = new AnkiClient(() => this.settings.ankiConnectUrl);

  async onload(): Promise<void> {
    await this.loadPluginData();

    this.addCommand({
      id: 'sync-active-file-to-anki',
      name: '同步当前笔记到 Anki',
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) {
          return false;
        }
        if (!checking) {
          void this.syncFile(file);
        }
        return true;
      },
    });

    this.addSettingTab(new ObsidianAnkiSyncSettingTab(this.app, this));
  }

  private getActiveMarkdownFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file ?? null;
    if (!isMarkdownFile(file)) {
      return null;
    }
    return file;
  }

  private async loadPluginData(): Promise<void> {
    const stored = (await this.loadData()) as Partial<PluginData> | undefined;
    const defaults = createDefaultData();

    if (stored?.settings) {
      this.settings = { ...defaults.settings, ...stored.settings };
    } else if (stored && 'mySetting' in stored) {
      // 兼容模版插件生成的数据结构
      this.settings = { ...defaults.settings };
    } else {
      this.settings = { ...defaults.settings };
    }

    this.cards = stored?.cards ?? {};
    this.anki = new AnkiClient(() => this.settings.ankiConnectUrl);
  }

  async savePluginData(): Promise<void> {
    const data: PluginData = {
      settings: this.settings,
      cards: this.cards,
    };
    await this.saveData(data);
  }

  private async renderMarkdown(content: string, file: TFile): Promise<string> {
    const container = document.createElement('div');
    await MarkdownRenderer.renderMarkdown(content, container, file.path, this);
    return container.innerHTML;
  }

  private buildCardTags(cardId: string, file: TFile): string[] {
    const tags = ['obsidian-anki-sync', `obsidian_card::${cardId}`];
    const pathTag = sanitizePathForTag(file.path);
    if (pathTag) {
      tags.push(`obsidian_path::${pathTag}`);
    }
    return tags;
  }

  private async buildFrontField(card: FlashcardDefinition, file: TFile, breadcrumb: string, link: string): Promise<string> {
    const rendered = await this.renderMarkdown(card.front, file);
    const breadcrumbHtml = `<div class="obsidian-anki-breadcrumb">${escapeHtml(breadcrumb)}</div>`;
    const linkHtml = `<div class="obsidian-anki-link"><a href="${link}">Open in Obsidian</a></div>`;
    return `${breadcrumbHtml}${linkHtml}<div class="obsidian-anki-front">${rendered}</div>`;
  }

  private async buildBackField(card: FlashcardDefinition, file: TFile, breadcrumb: string): Promise<string> {
    const rendered = await this.renderMarkdown(card.back, file);
    const breadcrumbHtml = `<div class="obsidian-anki-breadcrumb">${escapeHtml(breadcrumb)}</div>`;
    return `${breadcrumbHtml}<div class="obsidian-anki-back">${rendered}</div>`;
  }

  private async syncFile(file: TFile): Promise<void> {
    const marker = this.settings.flashcardMarker.trim();
    if (!marker) {
      new Notice('请先在设置中配置闪卡标识。');
      return;
    }

    let content: string;
    try {
      content = await this.app.vault.cachedRead(file);
    } catch (error) {
      console.error(error);
      new Notice('读取笔记内容失败。');
      return;
    }

    const flashcards = extractFlashcards(content, marker);
    if (flashcards.length === 0) {
      new Notice('未找到需要同步的闪卡。');
      return;
    }

    const deckName = buildDeckName(file, this.settings.deckRootName);
    const breadcrumb = buildBreadcrumb(file);
    const vaultName = this.app.vault.getName();

    const result: SyncResult = {
      added: 0,
      updated: 0,
      errors: [],
    };

    try {
      await this.anki.createDeck(deckName);
    } catch (error) {
      console.error(error);
      new Notice((error as Error).message);
      return;
    }

    for (const card of flashcards) {
      const cardId = computeCardId(file.path, card.front, card.back);
      const link = createObsidianLink(vaultName, file, card.lineNumber);
      const tags = this.buildCardTags(cardId, file);
      const cardTag = `obsidian_card::${cardId}`;

      try {
        let noteId: number | null = this.cards[cardId]?.noteId ?? null;
        if (!noteId) {
          noteId = await this.anki.findNoteByTag(cardTag);
        }

        const frontField = await this.buildFrontField(card, file, breadcrumb, link);
        const backField = await this.buildBackField(card, file, breadcrumb);

        if (noteId) {
          await this.anki.updateNoteFields(noteId, { Front: frontField, Back: backField });
          await this.anki.addTags(noteId, tags);
          await this.anki.ensureNoteInDeck(noteId, deckName);
          this.cards[cardId] = { noteId, file: file.path, line: card.lineNumber };
          result.updated += 1;
        } else {
          const newNoteId = await this.anki.addNote({
            deckName,
            modelName: 'Basic',
            fields: {
              Front: frontField,
              Back: backField,
            },
            tags,
          });
          this.cards[cardId] = { noteId: newNoteId, file: file.path, line: card.lineNumber };
          result.added += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('同步闪卡失败', { file: file.path, card, error });
        result.errors.push(`第 ${card.lineNumber} 行: ${message}`);
      }
    }

    await this.savePluginData();

    if (result.errors.length > 0) {
      new Notice(`同步完成，但存在 ${result.errors.length} 个错误。详情请查看控制台。`);
    } else {
      new Notice(`同步完成：新增 ${result.added} 张，更新 ${result.updated} 张。`);
    }
  }
}

class ObsidianAnkiSyncSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ObsidianAnkiSyncPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Obsidian Anki 同步' });

    new Setting(containerEl)
      .setName('闪卡标识')
      .setDesc(
        '设定注释标识。假设填入 ANKI，则可在笔记中使用 <!--ANKI-START-->、<!--ANKI-BACK-->、<!--ANKI-END--> 包裹卡片内容。',
      )
      .addText((text) =>
        text
          .setPlaceholder('ANKI')
          .setValue(this.plugin.settings.flashcardMarker)
          .onChange(async (value) => {
            this.plugin.settings.flashcardMarker = value;
            await this.plugin.savePluginData();
          }),
      );

    new Setting(containerEl)
      .setName('顶层牌组名称')
      .setDesc('按照笔记所在的文件夹层级创建子牌组。')
      .addText((text) =>
        text
          .setPlaceholder('Obsidian')
          .setValue(this.plugin.settings.deckRootName)
          .onChange(async (value) => {
            this.plugin.settings.deckRootName = value || DEFAULT_SETTINGS.deckRootName;
            await this.plugin.savePluginData();
          }),
      );

    new Setting(containerEl)
      .setName('AnkiConnect 地址')
      .setDesc('通常保持默认即可，如果修改了端口或启用了 HTTPS，请在此更新。')
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.ankiConnectUrl)
          .setValue(this.plugin.settings.ankiConnectUrl)
          .onChange(async (value) => {
            this.plugin.settings.ankiConnectUrl = value || DEFAULT_SETTINGS.ankiConnectUrl;
            await this.plugin.savePluginData();
          }),
      );
  }
}
