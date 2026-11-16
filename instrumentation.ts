// Runs once when the server starts (Next.js instrumentation hook). Checks the environment variables and,
// in production, refuses to start when something required is missing (see lib/env-check.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { enforceEnv } = await import('./lib/env-check');
  enforceEnv();
}
