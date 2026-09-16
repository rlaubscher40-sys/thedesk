import { expect, it } from "vitest";
import { requestFailure, requestFailureDescription } from "./requestFailure";

it.each([
  ["ENOTFOUND", "dns"],
  ["ERR_TLS_CERT_ALTNAME_INVALID", "tls"],
  ["CERT_HAS_EXPIRED", "tls"],
  ["ECONNREFUSED", "connection"],
  ["ENETUNREACH", "connection"],
  ["ETIMEDOUT", "timeout"],
  ["ERR_BUFFER_TOO_LARGE", "response-too-large"],
  ["Z_DATA_ERROR", "response-decoding"],
  ["SECRET_UNKNOWN_CODE", "fetch-failed"],
])("classifies %s without exposing request details", (code, expected) => {
  const error = Object.assign(new Error("https://user:secret@example.org/?token=secret"), { code });
  expect(requestFailure(error)).toBe(expected);
  expect(requestFailureDescription[requestFailure(error)]).not.toContain("secret");
});

it.each([
  ["Outbound response too large", "response-too-large"],
  ["Non-public outbound DNS answer", "unsafe-destination"],
  ["Outbound POST redirect denied", "redirect"],
  ["Unsupported outbound encoding", "response-decoding"],
  ["timeout https://example.org?token=secret", "fetch-failed"],
])("recognises only fixed transport messages: %s", (message, expected) => {
  expect(requestFailure(new Error(message))).toBe(expected);
});

it("unwraps bounded causes and distinguishes a cancelled request from its timeout cause", () => {
  const timeout = new DOMException("private details", "TimeoutError");
  const aborted = Object.assign(new Error("private details", { cause: timeout }), {
    name: "AbortError",
  });
  expect(requestFailure(aborted)).toBe("timeout");
  expect(requestFailure(new DOMException("cancelled", "AbortError"))).toBe("aborted");
  const cycle = new Error("private details");
  cycle.cause = cycle;
  expect(requestFailure(cycle)).toBe("fetch-failed");
  expect(requestFailure({ code: "ENOTFOUND", message: "secret" })).toBe("fetch-failed");
});

it("does not invent one cause for mixed connection attempts", () => {
  const dns = Object.assign(new Error("private host"), { code: "ENOTFOUND" });
  const tls = Object.assign(new Error("private host"), { code: "CERT_HAS_EXPIRED" });
  expect(requestFailure(new AggregateError([dns, dns]))).toBe("dns");
  expect(requestFailure(new AggregateError([dns, tls]))).toBe("fetch-failed");
});
