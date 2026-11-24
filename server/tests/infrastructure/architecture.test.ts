import assert from 'node:assert/strict';
import { readdirSync,readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { dirname,join,relative,resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../../', import.meta.url));
function files(folder: string): string[] {
    return readdirSync(join(root, folder), { withFileTypes: true }).flatMap(entry => {
        const name = join(folder, entry.name);
        return entry.isDirectory() ? files(name) : /\.(ts|vue)$/.test(name) && !name.includes('/tests/') ? [name] : [];
    });
}

test('shared, infrastructure and feature imports preserve client/server ownership without runtime cycles', () => {
    const sources = [...files('server'), ...files('shared'), ...files('src')];
    const graph = new Map<string, string[]>();
    const failures: string[] = [];
    for (const name of sources) {
        let text = readFileSync(join(root, name), 'utf8');
        if (name.endsWith('.vue')) text = text.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '';
        const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
        const edges: string[] = [];
        function visit(node: ts.Node) {
            let spec: string | undefined;
            let runtime = true;
            if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
                spec = node.moduleSpecifier.text;
                const clause = node.importClause;
                runtime = !clause?.isTypeOnly && !(clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && !clause.name && clause.namedBindings.elements.every(element => element.isTypeOnly));
            } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                spec = node.moduleSpecifier.text;
                runtime = !node.isTypeOnly;
            } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
                spec = node.arguments[0].text;
            }
            if (spec) {
                let target = spec.startsWith('.') ? relative(root, resolve(root, dirname(name), spec)) : spec.startsWith('@shared/') ? 'shared/' + spec.slice(8) : spec.startsWith('@/') ? 'src/' + spec.slice(2) : undefined;
                if (target) {
                    if (!/\.(ts|vue)$/.test(target)) target += '.ts';
                    if (name.startsWith('shared/') && !target.startsWith('shared/')) failures.push(`${name} imports ${spec}`);
                    if (name.startsWith('server/infrastructure/') && !target.startsWith('server/infrastructure/') && !target.startsWith('shared/')) failures.push(`${name} imports ${spec}`);
                    if (name.startsWith('server/features/') && target.startsWith('server/app/')) failures.push(`${name} imports application code`);
                    if (name.startsWith('src/') && target.startsWith('server/')) failures.push(`${name} imports server code`);
                    if (runtime && !name.startsWith('src/')) edges.push(target);
                }
                if (spec.startsWith('netlify/')) failures.push(`${name} uses the removed alias`);
                if (name.startsWith('shared/') && (isBuiltin(spec) || /^(express|mysql2|sharp|ws|dotenv|@sentry\/node)(\/|$)/.test(spec))) failures.push(`${name} imports server dependency ${spec}`);
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
        graph.set(name, edges);
    }
    const done = new Set<string>();
    const active: string[] = [];
    function walk(name: string) {
        if (active.includes(name)) { failures.push('Runtime cycle: ' + [...active.slice(active.indexOf(name)), name].join(' → ')); return; }
        if (done.has(name)) return;
        done.add(name); active.push(name);
        for (const dependency of graph.get(name) ?? []) walk(dependency);
        active.pop();
    }
    for (const name of graph.keys()) walk(name);
    assert.deepEqual(failures, []);
});
