export interface AddNoteParams {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
}

interface InvokePayload {
  action: string;
  version: number;
  params?: Record<string, unknown>;
}

interface InvokeResponse<T> {
  result: T;
  error: string | null;
}

interface NotesInfoResult {
  noteId: number;
  cards: number[];
}

export class AnkiClient {
  constructor(private readonly getUrl: () => string) {}

  private async invoke<T>(action: string, params?: Record<string, unknown>): Promise<T> {
    const payload: InvokePayload = {
      action,
      version: 6,
      params,
    };

    let response: Response;
    try {
      response = await fetch(this.getUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new Error('无法连接到 AnkiConnect，请确认 Anki 已启动并启用插件。');
    }

    if (!response.ok) {
      throw new Error(`AnkiConnect 返回错误状态：${response.status}`);
    }

    const data = (await response.json()) as InvokeResponse<T>;
    if (data.error) {
      throw new Error(data.error);
    }

    return data.result;
  }

  async createDeck(deckName: string): Promise<void> {
    await this.invoke('createDeck', { deck: deckName });
  }

  async addNote(note: AddNoteParams): Promise<number> {
    const result = await this.invoke<number | null>('addNote', {
      note: {
        deckName: note.deckName,
        modelName: note.modelName,
        fields: note.fields,
        tags: note.tags ?? [],
        options: {
          allowDuplicate: false,
          duplicateScope: 'deck',
          duplicateScopeOptions: {
            deckName: note.deckName,
          },
        },
      },
    });

    if (result === null) {
      throw new Error('添加笔记失败，Anki 返回了空结果。');
    }

    return result;
  }

  async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void> {
    await this.invoke('updateNoteFields', {
      note: {
        id: noteId,
        fields,
      },
    });
  }

  async addTags(noteId: number, tags: string[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    await this.invoke('addTags', {
      notes: [noteId],
      tags: tags.join(' '),
    });
  }

  async findNoteByTag(tag: string): Promise<number | null> {
    const notes = await this.invoke<number[]>('findNotes', {
      query: `tag:${tag}`,
    });

    if (notes.length === 0) {
      return null;
    }

    return notes[0];
  }

  async ensureNoteInDeck(noteId: number, deckName: string): Promise<void> {
    const notes = await this.invoke<NotesInfoResult[]>('notesInfo', { notes: [noteId] });
    if (notes.length === 0) {
      return;
    }

    const cards = notes[0].cards;
    if (!cards || cards.length === 0) {
      return;
    }

    await this.invoke('changeDeck', { cards, deck: deckName });
  }
}
