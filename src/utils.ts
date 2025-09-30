import type { TFile } from 'obsidian';

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeForHash(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function computeCardId(filePath: string, front: string, back: string): string {
  const normalizedFront = normalizeForHash(front);
  const normalizedBack = normalizeForHash(back);
  const source = `${filePath}::${normalizedFront}::${normalizedBack}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function sanitizeDeckSegment(segment: string): string {
  return segment.replace(/:/g, '-').trim();
}

export function buildDeckName(file: TFile, root: string): string {
  const normalizedRoot = root.trim();
  const segments = file.path.split('/');
  segments.pop();
  const deckSegments = [normalizedRoot, ...segments]
    .filter((segment) => segment.length > 0)
    .map((segment) => sanitizeDeckSegment(segment));
  return deckSegments.join('::') || normalizedRoot;
}

export function buildBreadcrumb(file: TFile): string {
  const parts = file.path.split('/');
  if (parts.length === 0) {
    return file.basename;
  }
  parts[parts.length - 1] = file.basename;
  return parts.join(' / ');
}

export function createObsidianLink(vault: string, file: TFile, line: number): string {
  const fileParam = encodeURIComponent(file.path);
  const vaultParam = encodeURIComponent(vault);
  return `obsidian://open?vault=${vaultParam}&file=${fileParam}&line=${line}`;
}

export function sanitizePathForTag(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .split('/')
    .map((segment) => segment.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_'))
    .filter((segment) => segment.length > 0)
    .join('::');
}
