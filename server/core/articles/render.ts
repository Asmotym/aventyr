import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import { generateJSON } from '@tiptap/html/server';
import { marked, Renderer } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { articleExtensions, validateDocument, type ArticleDocument } from './document';
import { hljs } from '../utils/markdown-highlight';

const BLOCK_COLOR_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol'];
const COLOR_ATTRIBUTES = ['style', 'data-text-color', 'data-background-color'];

export function sanitizeArticleHtml(html: string): string {
    return sanitizeHtml(html, {
        allowedTags: ['p','br','strong','em','s','blockquote','code','pre','ul','ol','li','h1','h2','h3','h4','h5','h6','a','hr','table','thead','tbody','tr','th','td','img','input','span','label','div','u'],
        allowedAttributes: { ...Object.fromEntries(BLOCK_COLOR_TAGS.map(tag => [tag, COLOR_ATTRIBUTES])), table: ['style', 'data-table-alignment'], a: ['href','target','rel'], img: ['src','alt','title','width','height'], input: ['type','checked','disabled'], code: ['class'], span: ['class','style'], li: ['data-type','data-checked'], ul: ['data-type', ...COLOR_ATTRIBUTES], th: ['colspan','rowspan','align','style','data-text-color','data-background-color'], td: ['colspan','rowspan','align','style','data-text-color','data-background-color'], ol: ['start', ...COLOR_ATTRIBUTES] },
        allowedStyles: { table: { width: [/^(75|100)%$/], 'margin-left': [/^(auto|0)$/], 'margin-right': [/^(auto|0)$/] }, ...Object.fromEntries(BLOCK_COLOR_TAGS.map(tag => [tag, { color: [/^#[0-9a-f]{6}$/i], 'background-color': [/^#[0-9a-f]{6}$/i] }])), th: { color: [/^#[0-9a-f]{6}$/i], 'background-color': [/^#[0-9a-f]{6}$/i] }, td: { color: [/^#[0-9a-f]{6}$/i], 'background-color': [/^#[0-9a-f]{6}$/i] }, span: { color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/] } },
        allowedSchemes: ['http','https','mailto'], allowProtocolRelative: false,
        transformTags: { b: 'strong', i: 'em', del: 's', a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }), input: (_tag, attrs) => ({ tagName: 'input', attribs: { type: 'checkbox', disabled: '', ...('checked' in attrs ? { checked: '' } : {}) } }) }
    });
}
export function renderArticleDocument(document: ArticleDocument): string {
    const doc = validateDocument(document);
    let html = renderToHTMLString({ content: doc.content, extensions: articleExtensions() });
    html = html.replace(/<pre([^>]*)><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g, (full, preAttributes: string, language: string, source: string) => {
        if (!language || !hljs.getLanguage(language)) return full;
        const text = source.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
        return `<pre${preAttributes}><code class="language-${language}">${hljs.highlight(text, { language }).value}</code></pre>`;
    });
    return sanitizeArticleHtml(html);
}
export function articleExcerpt(html: string): string { return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim().slice(0, 260); }
export function markdownToDocument(markdown: string): ArticleDocument {
    const renderer = new Renderer();
    renderer.listitem = function(item) {
        const body = this.parser.parse(item.tokens);
        return item.task
            ? `<li data-type="taskItem" data-checked="${item.checked ? 'true' : 'false'}"><label><input type="checkbox" ${item.checked ? 'checked' : ''}></label><div>${body}</div></li>`
            : `<li>${body}</li>`;
    };
    renderer.list = function({ items, ordered, start }) {
        let html = '';
        let index = 0;
        while (index < items.length) {
            const task = Boolean(items[index].task);
            const tag = task || !ordered ? 'ul' : 'ol';
            html += `<${tag}${task ? ' data-type="taskList"' : ''}${!task && ordered ? ` start="${Number(start) + index}"` : ''}>`;
            do { html += this.listitem(items[index++]); } while (index < items.length && Boolean(items[index].task) === task);
            html += `</${tag}>`;
        }
        return html;
    };
    const rawHtml = marked.parse(markdown, { async: false, gfm: true, breaks: true, renderer }) as string;
    const supportedTags = new Set(['p','br','strong','b','em','i','del','s','u','blockquote','code','pre','ul','ol','li','h1','h2','h3','h4','h5','h6','a','hr','table','thead','tbody','tr','th','td','img','input','span','label','div']);
    for (const match of rawHtml.matchAll(/<\/?([a-z][a-z0-9]*)\b/gi)) {
        if (!supportedTags.has(match[1].toLowerCase())) throw new Error(`Unsupported HTML element ${match[1]}; manual review required`);
    }
    const html = sanitizeArticleHtml(rawHtml);
    const content = generateJSON(html, articleExtensions());
    const doc = validateDocument({ version: 1, content });
    // Compare visible text after parsing; an unsupported HTML block must never disappear unnoticed.
    const visibleText = (source: string) => sanitizeHtml(source, { allowedTags: [], allowedAttributes: {} }).replace(/\s/g, '');
    const before = visibleText(html);
    const after = visibleText(renderArticleDocument(doc));
    if (before !== after) throw new Error('Markdown conversion changed visible content; manual review required');
    return doc;
}
