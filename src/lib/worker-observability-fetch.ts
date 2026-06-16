const FETCH_PATCH_STATE = Symbol.for("ticket-triage.worker-observability-fetch");
const TRAILING_SLASHES_REGEX = /\/+$/;

type WorkerObservabilityFetchState = {
  installedTargets: Array<{ origin: string; pathPrefix: string }>;
  originalFetch: typeof globalThis.fetch;
};

const OTLP_SIGNAL_PATHS = new Set(["/v1/traces", "/v1/logs", "/v1/metrics"]);

const getFetchPatchState = () => {
  const globalState = globalThis as typeof globalThis & {
    [FETCH_PATCH_STATE]?: WorkerObservabilityFetchState;
  };

  if (globalState[FETCH_PATCH_STATE]) {
    return globalState[FETCH_PATCH_STATE];
  }

  const state: WorkerObservabilityFetchState = {
    installedTargets: [],
    originalFetch: globalThis.fetch.bind(globalThis),
  };

  globalState[FETCH_PATCH_STATE] = state;

  return state;
};

const resolveRequestUrl = (input: RequestInfo | URL): URL | null => {
  if (input instanceof URL) {
    return input;
  }

  const rawUrl = typeof input === "string" ? input : input.url;

  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
};

const normalizeBaseUrl = (baseUrl: string) => {
  const url = new URL(baseUrl);
  const pathPrefix = url.pathname.replace(TRAILING_SLASHES_REGEX, "") || "/";

  return {
    origin: url.origin,
    pathPrefix,
  };
};

export const isOtelExportRequest = (
  input: RequestInfo | URL,
  observabilityTargets: Array<{ origin: string; pathPrefix: string }>
) => {
  const requestUrl = resolveRequestUrl(input);

  if (!requestUrl) {
    return false;
  }

  const matchingTarget = observabilityTargets.find(({ origin, pathPrefix }) => {
    if (origin !== requestUrl.origin) {
      return false;
    }

    if (pathPrefix === "/") {
      return true;
    }

    return requestUrl.pathname.startsWith(pathPrefix);
  });

  if (!matchingTarget) {
    return false;
  }

  return [...OTLP_SIGNAL_PATHS].some((suffix) => requestUrl.pathname.endsWith(suffix));
};

const cancelUnreadBody = (response: Response) => {
  if (!response.body || response.bodyUsed || response.body.locked) {
    return;
  }

  response.body.cancel().catch(() => {
    // Ignore cancellation races if another consumer started reading first.
  });
};

export const installWorkerObservabilityFetchPatch = (baseUrl: string) => {
  const state = getFetchPatchState();
  const observabilityTarget = normalizeBaseUrl(baseUrl);

  if (
    state.installedTargets.some(
      ({ origin, pathPrefix }) =>
        origin === observabilityTarget.origin && pathPrefix === observabilityTarget.pathPrefix
    )
  ) {
    return;
  }

  if (state.installedTargets.length === 0) {
    const originalFetch = state.originalFetch;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);

      if (isOtelExportRequest(input, state.installedTargets)) {
        queueMicrotask(() => {
          cancelUnreadBody(response);
        });
      }

      return response;
    }) as typeof globalThis.fetch;
  }

  state.installedTargets.push(observabilityTarget);
};
