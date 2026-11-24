import { marked } from 'marked';
import { validateDocument, type ArticleDocument } from '../../../../shared/articles/document';
import { markdownToDocument } from './render';
export function importArticleText(value: unknown): ArticleDocument {
    const input = value as {
        text?: unknown;
    } | null;
    if (!input || typeof input.text !== 'string')
        throw new Error('Text is required');
    if (new TextEncoder().encode(input.text).byteLength > 250000)
        throw new Error('Import text exceeds 250,000 bytes');
    const text = input.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (!text.trim())
        throw new Error('Import text is empty');
    // Detect syntax from parsed tokens so ordinary punctuation and HTML-like text stay literal.
    const markdownTypes = new Set(['heading', 'list', 'code', 'blockquote', 'hr', 'table', 'strong', 'em', 'codespan', 'del', 'link', 'image']);
    let markdown = false;
    marked.walkTokens(marked.lexer(text, { gfm: true }), token => {
        if (markdownTypes.has(token.type))
            markdown = true;
    });
    if (markdown)
        return markdownToDocument(text);
    return validateDocument({ version: 1, content: { type: 'doc', content: text.split(/\n[\t ]*\n+/).map(paragraph => ({
                type: 'paragraph', content: paragraph.split('\n').flatMap((line, index) => [
                    ...(index ? [{ type: 'hardBreak' }] : []), ...(line ? [{ type: 'text', text: line }] : [])
                ])
            })) } });
}
