let runCounter = 0;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

// This seed has rendered coverage for legacy room interactions, both dragon contact positions, and the Moon Door exit.
export const LEGACY_SMOKE_SEED = 'expanded-smoke-seed';

export const navigateToProof = async (cdp, gameUrl, {
  route,
  params = {},
  timeoutMilliseconds = 45000
} = {}) => {
  if (!route) throw new Error('A browser smoke test must declare its route');

  const targetUrl = new URL(gameUrl);
  targetUrl.searchParams.set('route', route);
  for (const [name, value] of Object.entries(params)) targetUrl.searchParams.set(name, String(value));
  const marker = `${process.pid}-${Date.now()}-${++runCounter}`;
  targetUrl.searchParams.set('smokeRun', marker);

  const navigation = await cdp.send('Page.navigate', { url: targetUrl.href });
  if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);

  const readyExpression = `(() => {
    try {
      return new URL(location.href).searchParams.get('smokeRun') === ${JSON.stringify(marker)}
        && document.readyState !== 'loading'
        && Boolean(window.__HMW_THIRD_PERSON_PROOF__?.snapshot?.().ready);
    } catch {
      return false;
    }
  })()`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    try {
      const result = await cdp.send('Runtime.evaluate', {
        expression: readyExpression,
        awaitPromise: true,
        returnByValue: true
      });
      if (!result.exceptionDetails && result.result.value) return targetUrl.href;
    } catch {
      // Navigation destroys the prior execution context briefly; retry against the next document.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for the ${route} smoke-test document to become ready: ${targetUrl.href}`);
};
