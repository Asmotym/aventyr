# Article documents and translations

Articles use a shared Tiptap schema (`server/core/articles/document.ts`) and a versioned envelope:

```json
{
  "translations": {
    "en": {
      "title": "Example",
      "introduction": "Introduction",
      "document": {
        "version": 1,
        "content": { "type": "doc", "content": [{ "type": "paragraph" }] }
      }
    }
  }
}
```

English is required. Optional keys are `fr`, `es`, and `de`. Admin article create/update and draft save require the complete translations collection; omitting a language from the collection removes it. Drafts and unpublished articles may be incomplete. Publishing, scheduling, and editing published articles require a nonempty title, introduction, and body in every added language. Tags, author, UID, canonical slug, publication date, archive state, and status belong to the article as a whole. Updating translations never changes the canonical slug.

Public list, news, and detail endpoints accept `?locale=fr` (English by default). Each result contains `requestedLocale`, `resolvedLocale`, and `availableLocales`. Missing languages fall back to the entire English version, including its title and introduction. Search matches the resolved title before pagination. Admin details and drafts include JSON translations. Public HTML and excerpts are generated and sanitized on the server; the public reader does not load Tiptap.

## Block menu

Click the block drag grip (or press Enter/Space while it is focused) to open its action menu; dragging the grip still reorders the block. Every block has Delete. Paragraphs, headings, quotes, lists, and code blocks offer text/background colors when their contents contain only text. Media, tables, dividers, and containers containing media omit the color action. Color changes apply to the whole block, are stored in its JSON attributes, and survive public rendering. Deletion and colors support undo.

For table blocks, the grip menu offers **Table alignment**: Left, Center, Right, or Full width. Aligned tables use 75% of the available width; full-width tables use 100%. Alignment is part of the shared JSON schema, validated and sanitized on the server, preserved in public HTML, and supports undo. Cell text alignment remains independent.

## Table controls and saved colors

Hovering a table cell reveals row and column handles plus a cell actions button. The cell menu selects just that cell and offers text/background colors and clearing its contents without changing its neighbors. Opening either handle selects the full row/column and outlines it before showing its actions. Menus support inserting on either side, duplicating, clearing contents, deleting, toggling header cells, and applying text/background colors. Duplication is disabled for tables with merged cells so spans are preserved. Actions are part of the editor's undo history.

The selection formatting popup's color menu offers presets, a custom picker, and separate Recent/Custom sections (eight colors each). `GET /api/users/:userId/editor-colors` loads the authenticated user's history; `POST` with `{ "color": "#6395cf" }` records a six-digit hex color. Only the same authenticated user can read or change that history. The server categorizes preset/custom values and updates most-recent ordering transactionally. Histories are stored in `article_editor_preferences`, shared across articles, and restored on reload. Schema setup creates the table on server startup or with `npm run db:update`.

## Images

`POST /api/admin/article-images?draftId=<id>` or `?articleId=<id>` accepts raw JPEG, PNG, or WebP bytes, with the matching Content-Type. The limit is 5 MB and 40 million input pixels; static images become WebP, at most 2560 pixels per dimension without enlargement. The response contains `id` and a canonical `/api/article-images/<id>` URL. External image URLs must use HTTP(S); the server does not fetch them.

`DELETE /api/admin/article-images/<id>` deletes an unused upload with the same scope permissions. Images referenced by a saved translation cannot be deleted (409); remove them from all languages and save first. The editor also protects references in unsaved content.

`POST /api/admin/article-images?library=true` saves an image in the shared library without creating a draft. `GET /api/admin/article-images` without a scope lists shared images for authenticated article editors (admins/owners), including whether the current user can delete each image. The library opens in an overlay side panel so the document keeps its full width. Shared images can be reused across articles and writers. Existing uploads become library images when the `is_library` column is introduced; subsequent inline uploads are article/draft scoped unless the writer chooses to save to the library.

`GET /api/admin/article-images/<id>` returns an authenticated data URL for private editor previews. Shared library previews require an admin/owner. Scoped draft image access requires its owner; scoped article image access requires an administrator. `GET /api/article-images/<id>` returns WebP bytes only if a currently published, non-archived, non-future article references it. Responses are not cached so unpublishing revokes subsequent reads. Existing frontend-origin/API-key middleware continues to apply.

Saving accepts shared library IDs or images belonging to the document's article/source draft. Publishing transfers draft image associations and consumes the draft transactionally. References include every language and every article using a shared image. Only the uploader can delete a shared image, and deletion is rejected while any saved document references it. An hourly cleanup removes unreferenced scoped uploads older than 24 hours; shared library uploads are retained until explicitly deleted.

## Draft previews

Both draft selectors provide an eye button: hover, click, or activate it with the keyboard to open a compact rendered preview. Previews show the title, introduction, and first three top-level blocks in a height-limited popup. `GET /api/admin/articles/drafts/:draftId/preview` authorizes the draft owner and renders sanitized HTML on demand; private images use the existing authenticated preview endpoint. Closing or switching previews discards stale responses.

## Contextual writing tools

The document header labels the main article text. Select text with mouse, touch, or keyboard to reveal a formatting popup (block type, bold, italic, underline, strike, code, link, and color). Use Ctrl (Command on macOS) with B/I/U for bold/italic/underline, Shift+S for strike, E for inline code, K for a link on selected text, Z for undo, and Shift+Z (or Y) for redo. A keyboard-help menu in the document heading lists these shortcuts. They apply only while the document editor is focused. Undo/redo also remain available in the canvas footer. Slash commands insert blocks.

The image slash command creates an outlined **Add an image** block. Clicking it opens a nonmodal Upload/Link popover. File selection prompts whether to keep the upload in the shared library or use it only in the current article. Empty image placeholders are editor-only and are omitted from saved JSON/HTML. Uploaded images and valid HTTP(S) links replace the placeholder; upload failure leaves it available for retry.

## Migration and release

1. Back up the database and validate the release against a restored copy.
2. Run `npm run db:update` to add translation, image, and reference tables. Existing Markdown columns remain intact.
3. Run `npm run db:migrate:articles` against the copy, review any reported article/draft IDs, and repeat until all conversions succeed. Existing content becomes English. Unsupported HTML and visible-text changes stop conversion for that document without overwriting its Markdown.
4. Run the same migration against the deployment database before releasing the new editor. The command is idempotent and skips existing English JSON versions. Reading unmigrated public content still uses the legacy Markdown renderer.
5. Release frontend and API together. Check article lists, localized detail pages, publication, upload access, and autosave. Monitor `article.*` and `article.image.*` service errors and image cleanup warnings.

Do not roll back to a Markdown-only writer after JSON edits: the retained Markdown is a recovery copy of the original, not a continuously updated representation. Restore a coordinated database backup if a full rollback is required. Legacy column removal is a separate change.

## Verification

- `npm run server:test` — document validation, rendering and conversion plus the existing suite.
- `npm run server:test:articles` — creates and drops an isolated MySQL database using local root credentials, exercising translation storage, permissions, publication, image references and repeated migration.
- `npx playwright install chromium` then `npm run test:articles:browser` — browser tests with mocked APIs; no real Discord account or application data is used. Install Playwright's system dependencies if required. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an existing Chromium binary.
- `npm run server:typecheck`, `npm run server:build`, and `npm run build`.
