import ts from 'typescript';
import { parse } from '@astrojs/compiler-rs';

const platformNames = new Set(['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'fetch', 'requestAnimationFrame', 'cancelAnimationFrame', 'WebSocket', 'EventSource']);
const domTypes = /^(?:HTMLElement|HTML\w+Element|Document|Window|AbortSignal|AbortController|EventTarget|PointerEvent|MouseEvent|KeyboardEvent|TouchEvent|WebGL\w+|DOM\w+)$/;

export function parseCode(code, filename) {
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(filename) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const host = { getSourceFile: n => n === filename ? source : undefined, getDefaultLibFileName: () => '',
    writeFile() {}, getCurrentDirectory: () => '/', getDirectories: () => [], fileExists: n => n === filename,
    readFile: n => n === filename ? code : undefined, getCanonicalFileName: n => n, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n' };
  const checker = ts.createProgram([filename], { noLib: true, noResolve: true, allowJs: true }, host).getTypeChecker();
  const dependencies = [], platform = [], dynamic = [], bindings = new Map();
  const line = node => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const add = (node, expression, typeOnly = false) => {
    if (expression && ts.isStringLiteralLike(expression)) dependencies.push({ specifier: expression.text, typeOnly, line: line(node) });
    else dynamic.push({ line: line(node), text: node.getText(source).slice(0, 100) });
  };
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const clause = node.importClause, members = clause?.namedBindings;
      const exported = node.exportClause;
      const typeOnly = Boolean(node.isTypeOnly || clause?.isTypeOnly ||
        (!clause?.name && members && ts.isNamedImports(members) && members.elements.length && members.elements.every(e => e.isTypeOnly)) ||
        (exported && ts.isNamedExports(exported) && exported.elements.length && exported.elements.every(e => e.isTypeOnly)));
      add(node, node.moduleSpecifier, typeOnly);
      if (clause?.name) bindings.set(clause.name.text, node.moduleSpecifier.text);
      if (members && ts.isNamedImports(members)) for (const item of members.elements) bindings.set(item.name.text, node.moduleSpecifier.text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node, node.argument.literal, true);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node, node.moduleReference.expression, node.isTypeOnly);
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require' && !checker.getSymbolAtLocation(node.expression)))) add(node, node.arguments[0]);
    if (ts.isIdentifier(node) && (platformNames.has(node.text) || domTypes.test(node.text))) {
      const parent = node.parent;
      const property = (ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node) || ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent);
      if (!property && !checker.getSymbolAtLocation(node)?.declarations?.length) platform.push({ name: node.text, line: line(node) });
    }
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
        ts.isIdentifier(node.expression) && node.expression.text === 'globalThis' && !checker.getSymbolAtLocation(node.expression)?.declarations?.length) {
      const name = ts.isPropertyAccessExpression(node) ? node.name.text : ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined;
      if (platformNames.has(name)) platform.push({ name: `globalThis.${name}`, line: line(node) });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { dependencies, platform, dynamic, bindings, errors: source.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')) };
}

function walk(value, visitor) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const item of value) walk(item, visitor); return; }
  visitor(value);
  for (const [key, child] of Object.entries(value)) if (key !== 'parent') walk(child, visitor);
}

export function parseDocument(code, filename) {
  const parsed = parse(code), blocks = [], hydrated = [];
  // The Rust compiler reports UTF-8 byte offsets; JS string indices are UTF-16.
  const bytes = Buffer.from(code);
  const slice = node => bytes.subarray(node.start, node.end).toString('utf8');
  const program = parsed.ast.frontmatter?.program;
  const server = parseCode(program ? slice(program) : '', `${filename}#server.ts`);
  blocks.push({ suffix: '#server', browser: false, ...server });
  let index = 0;
  walk(parsed.ast.body, node => {
    if (node.type === 'AstroScript' && node.program) blocks.push({ suffix: `#client-${index++}`, browser: true, ...parseCode(slice(node.program), `${filename}#script.ts`) });
    if (node.type !== 'JSXOpeningElement') return;
    const attributes = node.attributes ?? [];
    if (attributes.some(a => a.name?.name?.startsWith('client:'))) {
      const specifier = server.bindings.get(node.name?.name);
      if (specifier) hydrated.push(specifier);
    }
    if (node.name?.name === 'script') {
      const src = attributes.find(a => a.name?.name === 'src')?.value?.value;
      if (typeof src === 'string') hydrated.push(src);
    }
  });
  blocks.push({ suffix: '#hydration', browser: true, dependencies: hydrated.map(specifier => ({ specifier, typeOnly: false, line: 1 })), platform: [], dynamic: [], errors: [] });
  return { blocks, errors: parsed.diagnostics.filter(d => d.severity === 'error').map(d => d.message) };
}
