/** Safe operational diagnostics. Never expose raw network/parser messages:
 * they can contain credentials, signed URLs, addresses or response content. */
export type RequestFailure =
  | "timeout"
  | "aborted"
  | "dns"
  | "tls"
  | "connection"
  | "response-too-large"
  | "unsafe-destination"
  | "redirect"
  | "response-decoding"
  | "fetch-failed";

export function requestFailure(error: unknown, depth = 0): RequestFailure {
  if (!(error instanceof Error)) return "fetch-failed";
  const code = "code" in error ? error.code : undefined;
  if (error.name === "TimeoutError" || code === "ETIMEDOUT") return "timeout";
  if (error.name === "AbortError" || code === "ABORT_ERR") {
    return depth < 2 && requestFailure(error.cause, depth + 1) === "timeout"
      ? "timeout"
      : "aborted";
  }
  if (["EAI_AGAIN", "ENOTFOUND"].includes(String(code))) return "dns";
  if (
    [
      "ERR_TLS_CERT_ALTNAME_INVALID",
      "CERT_HAS_EXPIRED",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
      "CERT_NOT_YET_VALID",
    ].includes(String(code))
  )
    return "tls";
  if (["ECONNRESET", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "EPIPE"].includes(String(code)))
    return "connection";
  if (code === "ERR_BUFFER_TOO_LARGE") return "response-too-large";
  if (["Z_DATA_ERROR", "Z_BUF_ERROR"].includes(String(code))) return "response-decoding";
  // Exact fixed messages owned by publicFetch, never publisher-supplied text.
  if (error.message === "Outbound response too large") return "response-too-large";
  if (
    [
      "Unsafe outbound URL",
      "Non-public outbound address",
      "Non-public outbound DNS answer",
    ].includes(error.message)
  )
    return "unsafe-destination";
  if (
    [
      "Too many outbound redirects",
      "Outbound POST redirect denied",
      "Outbound redirect limit",
    ].includes(error.message)
  )
    return "redirect";
  if (error.message === "Unsupported outbound encoding") return "response-decoding";
  if (depth < 2 && error instanceof AggregateError && error.errors.length) {
    const failures = error.errors.slice(0, 8).map((cause) => requestFailure(cause, depth + 1));
    if (error.errors.length <= 8 && failures.every((failure) => failure === failures[0]))
      return failures[0]!;
  }
  return depth < 2 ? requestFailure(error.cause, depth + 1) : "fetch-failed";
}

export const requestFailureDescription: Record<RequestFailure, string> = {
  timeout: "request timed out",
  aborted: "request aborted",
  dns: "DNS lookup failed",
  tls: "TLS verification failed",
  connection: "connection failed",
  "response-too-large": "response exceeds byte limit",
  "unsafe-destination": "destination rejected by outbound safety check",
  redirect: "redirect rejected",
  "response-decoding": "response decoding failed",
  "fetch-failed": "request failed",
};
