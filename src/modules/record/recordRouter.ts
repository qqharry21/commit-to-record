import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import express, { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { createApiResponse } from '@api-docs/openAPIResponseBuilders';
import { ResponseStatus, ServiceResponse } from '@common/models/serviceResponse';
import { formatDate } from '@common/utils/dateFormat';
import { getEnvVar } from '@common/utils/envConfig';
import { handleServiceResponse } from '@common/utils/httpHandlers';

import { RecordSchema } from './recordModel';
import { recordService } from './recordService';

export const recordRegistry = new OpenAPIRegistry();

export const recordRouter: Router = (() => {
  const router = express.Router();

  recordRegistry.registerPath({
    method: 'get',
    path: '/record',
    tags: ['Record'],
    responses: createApiResponse(z.array(RecordSchema), 'Success'),
  });

  recordRegistry.registerPath({
    method: 'post',
    path: '/record',
    tags: ['Record'],
    responses: createApiResponse(z.null(), 'Success'),
  });

  router.get('/', async (_req: Request, res: Response) => {
    const result = await recordService.readGoogleSheet({
      spreadsheetId: getEnvVar<string>('SPREAD_SHEET_ID', 'string'),
      range: `Sheet1!A2:B`,
    });

    const serviceResponse = new ServiceResponse(
      ResponseStatus.Success,
      'Successful to read data from sheet',
      result,
      StatusCodes.OK
    );
    handleServiceResponse(serviceResponse, res);
  });

  router.post('/', async (_req: Request, res: Response) => {
    const commitMessages = await recordService.getCommitMessages();
    const summarizeMessage = await recordService.getSummarizeMessage(commitMessages);

    await recordService.writeGoogleSheet({
      spreadsheetId: getEnvVar<string>('SPREAD_SHEET_ID', 'string'),
      range: `Sheet1!A1:B1`,
      values: [[formatDate(new Date()), summarizeMessage]],
    });

    const serviceResponse = new ServiceResponse(
      ResponseStatus.Success,
      'Insert data to sheet',
      summarizeMessage,
      StatusCodes.OK
    );
    handleServiceResponse(serviceResponse, res);
  });

  return router;
})();
