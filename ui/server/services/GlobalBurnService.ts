// Global Burn members-cobudget endpoint contract:
//   GET  https://<INSTANCE_URL>/api/burn/<EVENT_ID>/members-cobudget
//   Auth: Bearer <API_KEY>
//   200  -> JSON body: string[]  (lowercase-ish emails)
//   400  -> event does not exist
//   403  -> invalid API key
//   other / network failure -> treat instance URL / connectivity as the issue

export type GlobalBurnFetchResult =
  | { status: "OK"; emails: string[] }
  | { status: "INVALID_KEY" }
  | { status: "EVENT_NOT_FOUND" }
  | { status: "UNREACHABLE"; detail?: string };

export type GlobalBurnRoundConfig = {
  globalBurnInstanceUrl: string | null;
  globalBurnEventId: string | null;
  globalBurnApiKey: string | null;
};

const FETCH_TIMEOUT_MS = 10_000;

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127(\.\d{1,3}){3}$/,
  /^0\.0\.0\.0$/,
  /^10(\.\d{1,3}){3}$/,
  /^192\.168(\.\d{1,3}){2}$/,
  /^172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}$/,
  /^169\.254(\.\d{1,3}){2}$/,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

function isBlockedHost(hostname: string): boolean {
  // Dev bypass: admins running a local mock Global Burn server on localhost
  // need to be able to test the full flow end-to-end.
  if (process.env.NODE_ENV === "development") return false;
  const hostNoBrackets = hostname.replace(/^\[|\]$/g, "");
  return PRIVATE_IP_PATTERNS.some((re) => re.test(hostNoBrackets));
}

function buildMembersUrl(instanceUrl: string, eventId: string): URL {
  const base = new URL(instanceUrl);
  // Append the API path to whatever path the admin entered (usually "/")
  const basePath = base.pathname.replace(/\/+$/, "");
  base.pathname = `${basePath}/api/burn/${encodeURIComponent(
    eventId
  )}/members-cobudget`;
  return base;
}

export async function fetchGlobalBurnMembers(
  config: GlobalBurnRoundConfig
): Promise<GlobalBurnFetchResult> {
  const { globalBurnInstanceUrl, globalBurnEventId, globalBurnApiKey } = config;

  if (!globalBurnInstanceUrl || !globalBurnEventId || !globalBurnApiKey) {
    return { status: "UNREACHABLE", detail: "Missing configuration" };
  }

  let url: URL;
  try {
    url = buildMembersUrl(globalBurnInstanceUrl, globalBurnEventId);
  } catch {
    return { status: "UNREACHABLE", detail: "Invalid instance URL" };
  }

  if (process.env.NODE_ENV !== "development" && url.protocol !== "https:") {
    return {
      status: "UNREACHABLE",
      detail: "Instance URL must use https://",
    };
  }
  if (isBlockedHost(url.hostname)) {
    return {
      status: "UNREACHABLE",
      detail: "Instance hostname is not allowed",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${globalBurnApiKey}`,
        Accept: "application/json",
      },
      redirect: "error",
      signal: controller.signal,
    });
  } catch (err: any) {
    return {
      status: "UNREACHABLE",
      detail: err?.message || "Network error",
    };
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 200) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        status: "UNREACHABLE",
        detail: "Response was not valid JSON",
      };
    }
    if (
      !Array.isArray(body) ||
      !body.every((e): e is string => typeof e === "string")
    ) {
      return {
        status: "UNREACHABLE",
        detail: "Response was not an array of emails",
      };
    }
    const emails = body
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);
    return { status: "OK", emails };
  }

  if (response.status === 403) return { status: "INVALID_KEY" };
  if (response.status === 400) return { status: "EVENT_NOT_FOUND" };

  return {
    status: "UNREACHABLE",
    detail: `Unexpected response status ${response.status}`,
  };
}
