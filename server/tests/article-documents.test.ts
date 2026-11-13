import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDocument, emptyDocument, safeArticleUrl, documentHasContent } from '../core/articles/document';
import { markdownToDocument, renderArticleDocument } from '../core/articles/render';

test('article block documents validate version, schema, depth and size', () => {
    assert.equal(validateDocument(emptyDocument()).version, 1);
    assert.equal(documentHasContent(emptyDocument()), false);
    for (const content of [{ type: 'doc', content: [{ type: 'unknown' }] }, { type: 'doc', content: [{ type: 'text', text: 'outside paragraph' }] }]) assert.throws(() => validateDocument({ version: 1, content }));
    assert.throws(() => validateDocument({ version: 2, content: { type: 'doc' } }));
    assert.throws(() => validateDocument({ version: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(250_000) }] }] } }));
    let nested: object = { type: 'paragraph' };
    for (let i = 0; i < 35; i++) nested = { type: 'blockquote', content: [nested] };
    assert.throws(() => validateDocument({ version: 1, content: { type: 'doc', content: [nested] } }));
});
test('article links and image protocols reject script and data payloads', () => {
    for (const url of ['javascript:alert(1)', 'data:image/png;base64,abc', '//example.com/a.png', '/other/path']) {
        assert.equal(safeArticleUrl(url, true), false);
        assert.throws(() => validateDocument({ version: 1, content: { type: 'doc', content: [{ type: 'image', attrs: { src: url } }] } }));
    }
    assert.equal(safeArticleUrl('https://example.com/a.png', true), true);
    assert.equal(safeArticleUrl('mailto:test@example.com'), true);
});
test('Markdown conversion preserves tables, tasks, images, formatting and code', () => {
    const source = '# Heading\n\nHello **world** and *friend*.\n\n- [x] Done\n- [ ] Pending\n\n| A | B |\n| --- | --- |\n| C | D |\n\n![alt](https://example.com/a.png)\n\n```typescript\nconst x = 1;\n```\n\n<span style="color: #123456">Colored</span>';
    const document = markdownToDocument(source);
    const html = renderArticleDocument(document);
    for (const marker of ['<h1>', '<strong>world</strong>', 'data-type="taskList"', 'data-checked="true"', '<table', '<img', 'language-typescript', '#123456']) assert.ok(html.includes(marker), marker);
    assert.equal(documentHasContent(document), true);
});
test('article rendering escapes text and strips untrusted attributes', () => {
    const document = validateDocument({ version: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }] } });
    assert.ok(!renderArticleDocument(document).includes('<script>'));
    const imported = markdownToDocument('Safe <img src="https://example.com/a.png" onerror="alert(1)">');
    assert.ok(!renderArticleDocument(imported).includes('onerror'));
});


test('Markdown migration preserves nested list formatting and reports unsupported HTML', () => {
    const doc = markdownToDocument('- **Bold item**\n  - Nested *child*\n\n1. Numbered\n2. Next');
    const html = renderArticleDocument(doc);
    assert.ok(html.includes('<strong>Bold item</strong>'));
    assert.ok(html.includes('<em>child</em>'));
    assert.equal((html.match(/<ul/g) ?? []).length, 2);
    assert.ok(html.includes('<ol'));
    assert.throws(() => markdownToDocument('<details><summary>Hidden</summary>Content</details>'), /Unsupported HTML/);
});
