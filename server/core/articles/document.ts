import { Extension, getSchema, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { isArticleColor } from './colors';
import type { AppLocale } from '../types/locale.types';

export interface ArticleDocument { version: 1; content: JSONContent }
export interface ArticleTranslation { title: string; introduction: string; document: ArticleDocument }
export type ArticleTranslations = Partial<Record<AppLocale, ArticleTranslation>>;
export const emptyDocument = (): ArticleDocument => ({ version: 1, content: { type: 'doc', content: [{ type: 'paragraph' }] } });
export const ARTICLE_TABLE_ALIGNMENTS = ['left', 'center', 'right', 'full'] as const;
export type ArticleTableAlignment = typeof ARTICLE_TABLE_ALIGNMENTS[number];
export const ARTICLE_TEXT_BLOCK_TYPES = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'codeBlock'];
export function isTextOnlyArticleBlock(node: JSONContent): boolean {
    if (!node.type || !ARTICLE_TEXT_BLOCK_TYPES.includes(node.type)) return false;
    const allowed = new Set([...ARTICLE_TEXT_BLOCK_TYPES, 'listItem', 'taskItem', 'text', 'hardBreak']);
    const onlyText = (child: JSONContent): boolean => Boolean(child.type && allowed.has(child.type) && (child.content ?? []).every(onlyText));
    return onlyText(node);
}
function articleColorAttributes() {
    return Object.fromEntries(['textColor', 'backgroundColor'].map(name => [name, {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute(name === 'textColor' ? 'data-text-color' : 'data-background-color'),
        renderHTML: (attributes: Record<string, unknown>) => isArticleColor(attributes[name]) ? {
            [name === 'textColor' ? 'data-text-color' : 'data-background-color']: attributes[name],
            style: `${name === 'textColor' ? 'color' : 'background-color'}: ${attributes[name]}`
        } : {}
    }]));
}
const ArticleBlockColors = Extension.create({
    name: 'articleBlockColors',
    addGlobalAttributes() { return [{ types: ARTICLE_TEXT_BLOCK_TYPES, attributes: articleColorAttributes() }]; }
});
const ArticleTableAlignment = Extension.create({
    name: 'articleTableAlignment',
    addGlobalAttributes() {
        return [{ types: ['table'], attributes: {
            alignment: {
                default: 'full',
                parseHTML: (element: HTMLElement) => element.getAttribute('data-table-alignment') ?? 'full',
                renderHTML: (attributes: Record<string, unknown>) => {
                    const alignment = attributes.alignment as ArticleTableAlignment;
                    if (!ARTICLE_TABLE_ALIGNMENTS.includes(alignment)) return {};
                    return { 'data-table-alignment': alignment, style: `width: ${alignment === 'full' ? '100%' : '75%'}; margin-left: ${alignment === 'center' || alignment === 'right' ? 'auto' : '0'}; margin-right: ${alignment === 'center' || alignment === 'left' ? 'auto' : '0'}` };
                }
            }
        } }, { types: ['tableCell', 'tableHeader'], attributes: {
            ...articleColorAttributes(),
            align: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('align') ?? (element.style.textAlign || null),
                renderHTML: (attributes: Record<string, unknown>) => ['left', 'center', 'right'].includes(String(attributes.align)) ? { align: attributes.align } : {}
            }
        } }];
    }
});
export function articleExtensions() {
    return [StarterKit.configure({ link: { openOnClick: false } }), TableKit, Image, TaskList, TaskItem.configure({ nested: true }), TextStyle, Color, ArticleTableAlignment, ArticleBlockColors];
}
export function safeArticleUrl(value: unknown, image = false): boolean {
    if (typeof value !== 'string') return false;
    if (image && /^\/api\/article-images\/[a-f0-9-]{36}$/.test(value)) return true;
    try { const url = new URL(value); return ['http:', 'https:', ...(image ? [] : ['mailto:'])].includes(url.protocol); } catch { return false; }
}
export function validateDocument(value: unknown): ArticleDocument {
    if (!value || typeof value !== 'object' || new TextEncoder().encode(JSON.stringify(value)).byteLength > 250_000) throw new Error('Invalid or oversized article document');
    const doc = value as ArticleDocument;
    if (doc.version !== 1 || doc.content?.type !== 'doc') throw new Error('Unsupported article document version');
    let count = 0;
    const walk = (node: JSONContent, depth: number) => {
        if (++count > 10000 || depth > 32) throw new Error('Article document is too complex');
        if (!node || typeof node !== 'object' || !node.type) throw new Error('Invalid article block');
        if (node.type === 'image' && !safeArticleUrl(node.attrs?.src, true)) throw new Error('Invalid image URL');
        if (['tableCell', 'tableHeader', ...ARTICLE_TEXT_BLOCK_TYPES].includes(node.type)) for (const key of ['textColor', 'backgroundColor']) {
            if (node.attrs?.[key] != null && !isArticleColor(node.attrs[key])) throw new Error('Invalid table color or block color');
        }
        if (['tableCell', 'tableHeader'].includes(node.type) && node.attrs?.align && !['left', 'center', 'right'].includes(node.attrs.align)) throw new Error('Invalid table alignment');
        if (node.type === 'table' && node.attrs?.alignment != null && !ARTICLE_TABLE_ALIGNMENTS.includes(node.attrs.alignment)) throw new Error('Invalid table alignment');
        if (node.type === 'heading' && ![1,2,3,4,5,6].includes(node.attrs?.level)) throw new Error('Invalid heading');
        for (const mark of node.marks ?? []) {
            if (mark.type === 'link' && !safeArticleUrl(mark.attrs?.href)) throw new Error('Invalid link URL');
            if (mark.type === 'textStyle' && mark.attrs?.color && !/^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i.test(mark.attrs.color)) throw new Error('Invalid text color');
        }
        for (const child of node.content ?? []) walk(child, depth + 1);
    };
    walk(doc.content, 0);
    const schema = getSchema(articleExtensions());
    const parsed = schema.nodeFromJSON(doc.content);
    parsed.check();
    // Reject unknown attributes and marks instead of silently discarding them.
    const checkTypes = (node: JSONContent) => {
        const type = schema.nodes[node.type!];
        if (!type) throw new Error('Unknown article block');
        for (const key of Object.keys(node.attrs ?? {})) if (!(key in (type.spec.attrs ?? {}))) throw new Error('Unknown block attribute');
        for (const mark of node.marks ?? []) {
            const markType = schema.marks[mark.type];
            if (!markType) throw new Error('Unknown article formatting');
            for (const key of Object.keys(mark.attrs ?? {})) if (!(key in (markType.spec.attrs ?? {}))) throw new Error('Unknown formatting attribute');
        }
        node.content?.forEach(checkTypes);
    };
    checkTypes(doc.content);
    return { version: 1, content: parsed.toJSON() };
}
export function documentHasContent(document: ArticleDocument): boolean {
    const visit = (node: JSONContent): boolean => Boolean(node.text?.trim() || node.type === 'image' || node.content?.some(visit));
    return visit(document.content);
}
export function articleImageIds(translations: ArticleTranslations): string[] {
    const ids = new Set<string>();
    const visit = (node: JSONContent) => {
        const match = node.type === 'image' && String(node.attrs?.src).match(/^\/api\/article-images\/([a-f0-9-]{36})$/);
        if (match) ids.add(match[1]);
        node.content?.forEach(visit);
    };
    Object.values(translations).forEach(t => visit(t.document.content));
    return [...ids];
}
