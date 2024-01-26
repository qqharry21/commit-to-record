import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export type Record = z.infer<typeof RecordSchema>;
export const RecordSchema = z.tuple([z.string(), z.string()]);
