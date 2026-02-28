import type { FastifyPluginAsync, preHandlerHookHandler } from "fastify";
import fp from "fastify-plugin";
import type { ZodTypeAny } from "zod";

type RequestSchemaSet = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

type ValidatedPayload = {
  body?: unknown;
  params?: unknown;
  query?: unknown;
};

declare module "fastify" {
  interface FastifyRequest {
    validated: ValidatedPayload;
  }

  interface FastifyInstance {
    buildValidationPreHandler: (schemas: RequestSchemaSet) => preHandlerHookHandler;
  }
}

const validationPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("validated", {});

  app.decorate("buildValidationPreHandler", (schemas: RequestSchemaSet) => {
    return async (request, reply) => {
      const details: Record<string, unknown> = {};
      const validated: ValidatedPayload = {};

      if (schemas.params) {
        const parsed = schemas.params.safeParse(request.params);
        if (!parsed.success) {
          details.params = parsed.error.flatten();
        } else {
          validated.params = parsed.data;
          request.params = parsed.data as typeof request.params;
        }
      }

      if (schemas.query) {
        const parsed = schemas.query.safeParse(request.query);
        if (!parsed.success) {
          details.query = parsed.error.flatten();
        } else {
          validated.query = parsed.data;
          request.query = parsed.data as typeof request.query;
        }
      }

      if (schemas.body) {
        const parsed = schemas.body.safeParse(request.body);
        if (!parsed.success) {
          details.body = parsed.error.flatten();
        } else {
          validated.body = parsed.data;
          request.body = parsed.data as typeof request.body;
        }
      }

      if (Object.keys(details).length > 0) {
        reply.sendApiError(400, "VALIDATION_ERROR", details);
        return;
      }

      request.validated = validated;
    };
  });
};

export default fp(validationPlugin);
