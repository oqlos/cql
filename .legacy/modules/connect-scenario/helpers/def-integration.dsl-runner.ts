export type DslToolsRunner = {
  runDslConsole: (dslText: string, execContext?: any) => string;
};

export type DslModuleLoader = () => Promise<{ DslTools: DslToolsRunner }>;

export function getCurrentDslExecContext(): unknown {
  return (globalThis as any).__currentExecCtx || undefined;
}

export async function runDslConsoleWithLoader(
  dslText: string,
  loader: DslModuleLoader = () => import('../../../components/dsl'),
): Promise<string> {
  const { DslTools } = await loader();
  return DslTools.runDslConsole(dslText, getCurrentDslExecContext());
}