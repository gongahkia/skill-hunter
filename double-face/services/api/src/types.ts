import type { FastifyRequest } from "fastify";

export type RouteContext = {
  requestId: string;
  userId: string | null;
};

export function getRouteContext(request: FastifyRequest): RouteContext {
  return {
    requestId: request.id,
    userId: null
  };
}
