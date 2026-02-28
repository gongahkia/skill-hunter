import { zodToJsonSchema } from "zod-to-json-schema";

import {
  createContractRequestDtoSchema,
  createContractResponseDtoSchema,
  createFindingFeedbackRequestDtoSchema,
  createPolicyRuleRequestDtoSchema,
  createUploadUrlRequestDtoSchema,
  createUploadUrlResponseDtoSchema,
  listFindingsResponseDtoSchema,
  startReviewRequestDtoSchema,
  startReviewResponseDtoSchema,
  updateFindingStatusRequestDtoSchema,
  upsertPolicyProfileRequestDtoSchema
} from "./dto";

export const openApiDtoSchemas = {
  CreateContractRequestDto: zodToJsonSchema(createContractRequestDtoSchema, {
    target: "openApi3",
    name: "CreateContractRequestDto"
  }),
  CreateContractResponseDto: zodToJsonSchema(createContractResponseDtoSchema, {
    target: "openApi3",
    name: "CreateContractResponseDto"
  }),
  CreateUploadUrlRequestDto: zodToJsonSchema(createUploadUrlRequestDtoSchema, {
    target: "openApi3",
    name: "CreateUploadUrlRequestDto"
  }),
  CreateUploadUrlResponseDto: zodToJsonSchema(createUploadUrlResponseDtoSchema, {
    target: "openApi3",
    name: "CreateUploadUrlResponseDto"
  }),
  StartReviewRequestDto: zodToJsonSchema(startReviewRequestDtoSchema, {
    target: "openApi3",
    name: "StartReviewRequestDto"
  }),
  StartReviewResponseDto: zodToJsonSchema(startReviewResponseDtoSchema, {
    target: "openApi3",
    name: "StartReviewResponseDto"
  }),
  ListFindingsResponseDto: zodToJsonSchema(listFindingsResponseDtoSchema, {
    target: "openApi3",
    name: "ListFindingsResponseDto"
  }),
  UpdateFindingStatusRequestDto: zodToJsonSchema(
    updateFindingStatusRequestDtoSchema,
    {
      target: "openApi3",
      name: "UpdateFindingStatusRequestDto"
    }
  ),
  CreateFindingFeedbackRequestDto: zodToJsonSchema(
    createFindingFeedbackRequestDtoSchema,
    {
      target: "openApi3",
      name: "CreateFindingFeedbackRequestDto"
    }
  ),
  UpsertPolicyProfileRequestDto: zodToJsonSchema(
    upsertPolicyProfileRequestDtoSchema,
    {
      target: "openApi3",
      name: "UpsertPolicyProfileRequestDto"
    }
  ),
  CreatePolicyRuleRequestDto: zodToJsonSchema(createPolicyRuleRequestDtoSchema, {
    target: "openApi3",
    name: "CreatePolicyRuleRequestDto"
  })
} as const;
