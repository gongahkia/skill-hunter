import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { scrubLogMessage, scrubPii } from "../modules/security/pii-scrubber";

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

type LegacyErrorPayload = {
  error: string;
  message?: string;
  details?: unknown;
};

declare module "fastify" {
  interface FastifyReply {
    sendApiError: (
      statusCode: number,
      code: string,
      details?: unknown,
      message?: string
    ) => FastifyReply;
  }
}

function buildErrorEnvelope(
  requestId: string,
  code: string,
  message: string,
  details?: unknown
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details !== undefined ? { details } : {})
    }
  };
}

function toLegacyErrorPayload(
  code: string,
  details?: unknown,
  message?: string
): LegacyErrorPayload {
  return {
    error: code,
    ...(message ? { message } : {}),
    ...(details !== undefined ? { details } : {})
  };
}

const errorEnvelopePlugin: FastifyPluginAsync = async (app) => {
  app.decorateReply("sendApiError", function sendApiError(statusCode, code, details, message) {
    return this.status(statusCode).send(toLegacyErrorPayload(code, details, message));
  });

  app.addHook("preSerialization", (request, _reply, payload, done) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      done(null, payload);
      return;
    }

    const data = payload as Record<string, unknown>;
    if (typeof data.error !== "string") {
      done(null, payload);
      return;
    }

    const code = data.error;
    const message = typeof data.message === "string" ? data.message : code;
    const detailsFromPayload = data.details;
    const additionalDetails = Object.fromEntries(
      Object.entries(data).filter(
        ([key]) => key !== "error" && key !== "message" && key !== "details"
      )
    );
    const details =
      detailsFromPayload !== undefined
        ? detailsFromPayload
        : Object.keys(additionalDetails).length > 0
          ? additionalDetails
          : undefined;
    const envelope = buildErrorEnvelope(request.id, code, message, details);

    done(null, envelope);
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? Math.max(400, (error as { statusCode: number }).statusCode)
        : 500;
    const code =
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : statusCode >= 500
          ? "INTERNAL_SERVER_ERROR"
          : "REQUEST_ERROR";

    const details =
      typeof (error as { validation?: unknown }).validation !== "undefined"
        ? {
            validation: (error as { validation: unknown }).validation
          }
        : undefined;

    app.log.error(
      scrubPii({
        requestId: request.id,
        error
      }),
      scrubLogMessage("Unhandled request error")
    );

    const errorMessage = error instanceof Error ? error.message : "Unexpected error";
    reply.status(statusCode).send(toLegacyErrorPayload(code, details, errorMessage));
  });
};

export default fp(errorEnvelopePlugin);
