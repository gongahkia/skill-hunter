import { DiagnosticEvent } from './types';

export type DiagnosticLevel = DiagnosticEvent['level'];

const MAX_EVENTS = 250;
const diagnostics: DiagnosticEvent[] = [];

function stringifyDetails(details: unknown): string | undefined {
  if (typeof details === 'undefined') {
    return undefined;
  }

  if (details instanceof Error) {
    return `${details.name}: ${details.message}`;
  }

  if (typeof details === 'string') {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch (_error) {
    return String(details);
  }
}

function appendDiagnostic(
  level: DiagnosticLevel,
  scope: string,
  message: string,
  details?: unknown
): void {
  const detailsText = stringifyDetails(details);
  const baseEntry: DiagnosticEvent = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
  };
  const entry: DiagnosticEvent = detailsText
    ? { ...baseEntry, details: detailsText }
    : baseEntry;

  diagnostics.push(entry);
  if (diagnostics.length > MAX_EVENTS) {
    diagnostics.shift();
  }

  const consoleLabel = `[owl][${scope}] ${message}`;
  if (level === 'debug') {
    console.debug(consoleLabel, details ?? '');
  } else if (level === 'info') {
    console.info(consoleLabel, details ?? '');
  } else if (level === 'warn') {
    console.warn(consoleLabel, details ?? '');
  } else {
    console.error(consoleLabel, details ?? '');
  }
}

export function logDebug(scope: string, message: string, details?: unknown): void {
  appendDiagnostic('debug', scope, message, details);
}

export function logInfo(scope: string, message: string, details?: unknown): void {
  appendDiagnostic('info', scope, message, details);
}

export function logWarn(scope: string, message: string, details?: unknown): void {
  appendDiagnostic('warn', scope, message, details);
}

export function logError(scope: string, message: string, details?: unknown): void {
  appendDiagnostic('error', scope, message, details);
}

export function getDiagnostics(): DiagnosticEvent[] {
  return [...diagnostics];
}

export function clearDiagnostics(): void {
  diagnostics.splice(0, diagnostics.length);
}

export function formatDiagnosticsText(events: DiagnosticEvent[]): string {
  return events
    .map((event) => {
      const details = event.details ? ` | ${event.details}` : '';
      return `${event.timestamp} [${event.level.toUpperCase()}] (${event.scope}) ${event.message}${details}`;
    })
    .join('\n');
}
