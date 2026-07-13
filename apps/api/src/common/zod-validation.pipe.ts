import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

/**
 * Validates/parses the incoming value against a Zod schema.
 * Usage: `@Body(new ZodValidationPipe(MySchema)) dto: MyDto`.
 * A ZodError is rethrown as-is (unwrapped from BadRequest) so the global
 * exception filter can render the standard 422 error shape with field details.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw err;
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
