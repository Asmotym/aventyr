import test from 'node:test';
import assert from 'node:assert/strict';
import { importArticleText } from '../core/articles/import-text';
import { renderArticleDocument } from '../core/articles/render';

test('plain import preserves literal HTML-like text, Unicode and normalized line breaks', () => {
    const document = importArticleText({ text: '\uFEFFHéllo\r\n<b>world</b>\r\n\r\nNext' });
    assert.equal(document.content.content?.length, 2);
    assert.equal(document.content.content?.[0].content?.[1].type, 'hardBreak');
    const html = renderArticleDocument(document);
    assert.match(html, /Héllo/);
    assert.match(html, /&lt;b&gt;world&lt;\/b&gt;/);
});

test('Markdown imports supported structures through the existing converter', () => {
    const document = importArticleText({ text: '# Heading\n\n- one\n- two\n\n> Quote\n\n```js\nconst a = 1;\n```\n\n- [x] Done\n\n| A | B |\n| - | - |\n| C | D |\n\n[Link](https://example.com)' });
    const types = document.content.content!.map(node => node.type);
    for (const type of ['heading', 'bulletList', 'blockquote', 'codeBlock', 'taskList', 'table', 'paragraph']) assert.ok(types.includes(type), type);
});

test('invalid, empty, unsupported and oversized imports fail', () => {
    for (const input of [null, {}, { text: 42 }, { text: ' \r\n' }, { text: 'é'.repeat(125001) }, { text: '# Heading\n\n<script>alert(1)</script>' }, { text: 'x'.repeat(249999) }]) {
        assert.throws(() => importArticleText(input));
    }
});

test('unsafe Markdown links do not survive as unsafe URLs', () => {
    const document = importArticleText({ text: '[click](javascript:alert%281%29)' });
    assert.doesNotMatch(JSON.stringify(document), /javascript:/);
});


test('detects block and inline Markdown without a format hint', () => {
    for (const text of ['## Heading', 'Heading\n=======', '- Item', '1. Item', '> Quote', '```\ncode\n```', '**Bold**', '*Italic*', '`code`', '~~Deleted~~', '[Link](https://example.com)']) {
        const html = renderArticleDocument(importArticleText({ text }));
        assert.match(html, /<(h[12]|ul|ol|blockquote|pre|strong|em|code|s|a)\b/, text);
    }
});

test('ordinary punctuation remains plain text', () => {
    const text = 'Hello, world!\nPrice: $5 * 2 = $10. #hashtag\n\n<example>literal</example>';
    const document = importArticleText({ text });
    assert.equal(document.content.content?.length, 2);
    assert.match(renderArticleDocument(document), /&lt;example&gt;literal&lt;\/example&gt;/);
});
