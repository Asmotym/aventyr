import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { parse } from 'vue/compiler-sfc';
import { initAsyncCompiler } from 'sass-embedded';

const source = resolve('src');
const styles = resolve(source, 'assets/styles');
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

test('Vue styles stay external and static presentation stays out of templates', () => {
  for (const file of files(source).filter(file => file.endsWith('.vue'))) {
    const { descriptor, errors } = parse(readFileSync(file, 'utf8'), { filename: file });
    assert.deepEqual(errors, [], relative(source, file));
    for (const style of descriptor.styles) {
      assert.equal(style.content.trim(), '', `${file}: extract embedded styles`);
      assert.equal(style.lang, 'scss', `${file}: use SCSS`);
      assert.ok(style.src, `${file}: provide a stylesheet source`);
      const target = style.src!.startsWith('@/') ? resolve(source, style.src!.slice(2)) : resolve(dirname(file), style.src!);
      assert.ok(target.startsWith(styles + '/') && target.endsWith('.scss'), `${file}: styles belong in assets/styles`);
      assert.ok(readFileSync(target, 'utf8').trim(), `${file}: stylesheet must exist`);
    }
    type Root = NonNullable<NonNullable<typeof descriptor.template>['ast']>;
    function visit(node: Root | Root['children'][number]): void {
      for (const prop of 'props' in node ? node.props : []) {
        assert.ok(!(prop.type === 6 && prop.name === 'style'), `${file}: move static style attributes to SCSS`);
        if (prop.type === 6 && prop.name === 'class') {
          for (const name of (prop.value?.content ?? '').split(/\s+/).filter(Boolean)) {
            assert.ok(!/^(?:is-|has-)|^(?:active|selected|disabled)$/.test(name), `${file}: qualify state class ${name} with its BEM block/element`);
          }
        }
      }
      if ('children' in node) for (const child of node.children) if (typeof child !== 'string') visit(child);
    }
    if (descriptor.template?.ast) visit(descriptor.template.ast);
  }
});

test('authored styles use SCSS and compile independently with valid application class names', async () => {
  assert.deepEqual(files(source).filter(file => file.endsWith('.css')), []);
  const bem = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
  // Names provided by Vuetify, icons, rich text and syntax highlighting are external contracts.
  const external = /^(?:v-|mdi|hljs|ProseMirror|tiptap|selectedCell$|function_$|class_$)/;
  const compiler = await initAsyncCompiler();
  try {
    for (const file of files(styles).filter(file => file.endsWith('.scss'))) {
      const { css } = await compiler.compileAsync(file, { style: 'expanded' });
      for (const match of css.matchAll(/([^{}]+)\{/g)) {
        const selector = match[1]!;
        for (const token of selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
          const name = token[1]!;
          assert.ok(external.test(name) || bem.test(name), `${file}: invalid BEM class ${name}`);
        }
      }
    }
  } finally {
    await compiler.dispose();
  }
});
