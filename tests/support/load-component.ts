import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Playwright replaces react/jsx-runtime inside test files with its own
// component-testing objects, so components under test are compiled here with
// classic React.createElement and given the real modules they import.
export function loadComponent<T>(
  file: string,
  exportName: string,
  modules: Record<string, unknown>,
): T {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", file),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", outputText)((id: string) => {
    if (!(id in modules)) throw new Error(`unexpected import ${id}`);
    return modules[id];
  }, exports);
  return exports[exportName] as T;
}
