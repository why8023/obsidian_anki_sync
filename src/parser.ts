export interface FlashcardDefinition {
  front: string;
  back: string;
  lineNumber: number;
}

function countLinesUntil(content: string, index: number): number {
  if (index <= 0) {
    return 1;
  }
  const prefix = content.slice(0, index);
  const matches = prefix.match(/\r?\n/g);
  return (matches?.length ?? 0) + 1;
}

function findFirstNonWhitespaceOffset(text: string): number {
  const match = /[^\s]/.exec(text);
  return match ? match.index : -1;
}

export function extractFlashcards(content: string, marker: string): FlashcardDefinition[] {
  const normalizedMarker = marker.trim();
  if (!normalizedMarker) {
    return [];
  }

  const startToken = `<!--${normalizedMarker}-START-->`;
  const backToken = `<!--${normalizedMarker}-BACK-->`;
  const endToken = `<!--${normalizedMarker}-END-->`;

  const results: FlashcardDefinition[] = [];
  let searchIndex = 0;

  while (searchIndex < content.length) {
    const startIndex = content.indexOf(startToken, searchIndex);
    if (startIndex === -1) {
      break;
    }

    const backIndex = content.indexOf(backToken, startIndex + startToken.length);
    if (backIndex === -1) {
      searchIndex = startIndex + startToken.length;
      continue;
    }

    const endIndex = content.indexOf(endToken, backIndex + backToken.length);
    if (endIndex === -1) {
      searchIndex = startIndex + startToken.length;
      continue;
    }

    const frontRaw = content.slice(startIndex + startToken.length, backIndex);
    const backRaw = content.slice(backIndex + backToken.length, endIndex);

    const front = frontRaw.trim();
    const back = backRaw.trim();

    if (front && back) {
      const nonWhitespaceOffset = findFirstNonWhitespaceOffset(frontRaw);
      const position =
        nonWhitespaceOffset === -1
          ? startIndex
          : startIndex + startToken.length + nonWhitespaceOffset;
      const lineNumber = countLinesUntil(content, position);

      results.push({
        front,
        back,
        lineNumber,
      });
    }

    searchIndex = endIndex + endToken.length;
  }

  return results;
}
