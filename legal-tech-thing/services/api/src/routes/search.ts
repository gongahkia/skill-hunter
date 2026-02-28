import { semanticClauseSearchBodySchema } from "@legal-tech/shared-types";
import type { FastifyPluginAsync } from "fastify";

import { getEmbeddingProvider } from "../modules/embeddings/provider";
import { searchSemanticClauses } from "../modules/search/semantic-clause-search";

const searchRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/clauses",
    {
      preHandler: app.buildValidationPreHandler({
        body: semanticClauseSearchBodySchema
      })
    },
    async (request, reply) => {
      const body = request.validated.body as {
        queryText: string;
        contractId?: string;
        limit: number;
      };

      const provider = getEmbeddingProvider();
      const queryText = body.queryText.trim();
      const vectors = await provider.embedTexts([queryText]);
      const queryVector = vectors[0];

      if (!queryVector || queryVector.length === 0) {
        return reply.status(500).send({
          error: "SEMANTIC_QUERY_EMBEDDING_GENERATION_FAILED"
        });
      }

      const items = await searchSemanticClauses({
        prisma: app.prisma,
        ownerId: request.auth.userId,
        providerName: provider.name,
        queryVector,
        contractId: body.contractId,
        limit: body.limit
      });

      return reply.status(200).send({
        provider: provider.name,
        queryText,
        contractId: body.contractId ?? null,
        items
      });
    }
  );
};

export default searchRoutes;
