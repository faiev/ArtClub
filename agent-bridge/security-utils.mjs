const REDACTED_PATH = "[local path]";
const REDACTED_URL = "[URL]";

export class BridgeInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BridgeInputError";
    this.code = code;
  }
}

export function validateAppUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("ARTCLUB_URL must be a valid absolute URL.");
  }

  let url;
  try { url = new URL(value); }
  catch { throw new Error("ARTCLUB_URL must be a valid absolute URL."); }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("ARTCLUB_URL must use HTTPS (or HTTP on localhost for development).");
  }
  if (url.username || url.password) {
    throw new Error("ARTCLUB_URL must not contain embedded credentials.");
  }

  const host = url.hostname.toLowerCase();
  const isLoopback = host === "localhost" || host === "127.0.0.1" ||
    host === "::1" || host === "[::1]";
  if (url.protocol === "http:" && !isLoopback) {
    throw new Error("Insecure HTTP is allowed only for localhost development URLs.");
  }
  return url.href;
}

export function parseProjectJson(value) {
  if (typeof value !== "string" || value.length < 2) {
    throw new BridgeInputError(
      "INVALID_PROJECT_JSON",
      "project_json must be a JSON string containing a project object."
    );
  }

  let project;
  try {
    project = JSON.parse(value);
  } catch {
    throw new BridgeInputError(
      "INVALID_PROJECT_JSON",
      "project_json is not valid JSON."
    );
  }

  if (!project || typeof project !== "object" || Array.isArray(project)) {
    throw new BridgeInputError(
      "INVALID_PROJECT_SHAPE",
      "project_json must contain a project object, not null, an array or a primitive value."
    );
  }

  return project;
}

export function sanitizeToolErrorMessage(value, maxLength = 1_200) {
  const safeLimit = Number.isSafeInteger(maxLength) && maxLength > 0
    ? Math.min(maxLength, 4_000)
    : 1_200;
  let message = typeof value === "string" ? value : String(value ?? "Unknown error.");

  // Strip ANSI terminal escapes and all remaining control characters.
  message = message.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
  message = message.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");

  // Do not return machine-specific paths or arbitrary URL values to an agent.
  message = message.replace(
    /(?:[A-Za-z]:\\(?:[^\\\s"'<>]+\\?)+|\/(?:home|Users|workspace|workspaces|tmp|private|var|mnt|root|etc|opt|srv|app|build)\/[^\s"'<>]*)/g,
    REDACTED_PATH
  );
  message = message.replace(/\b(?:https?|file):\/\/[^\s"'<>]+/gi, REDACTED_URL);
  message = message.replace(/\s+/g, " ").trim();

  if (!message) message = "The operation failed.";
  if (message.length > safeLimit) {
    message = message.slice(0, safeLimit - 1).trimEnd() + "…";
  }
  return message;
}
