import { applyDecorators, HttpStatus, Type } from "@nestjs/common";
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from "@nestjs/swagger";

export class ApiSuccessEnvelopeDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: Object })
  data!: unknown;
}

interface ApiSuccessResponseOptions {
  description?: string;
  isArray?: boolean;
  status?: number;
}

export function ApiSuccessResponse(
  model: Type<unknown>,
  options: ApiSuccessResponseOptions = {},
) {
  const dataSchema = options.isArray
    ? { type: "array", items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(ApiSuccessEnvelopeDto, model),
    ApiResponse({
      status: options.status ?? HttpStatus.OK,
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessEnvelopeDto) },
          {
            properties: {
              data: dataSchema,
            },
          },
        ],
      },
    }),
  );
}
