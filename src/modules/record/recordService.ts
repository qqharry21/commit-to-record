import { Gitlab } from '@gitbeaker/node';
import { google } from 'googleapis';
import { StatusCodes } from 'http-status-codes';
import OpenAI from 'openai';

import { ResponseStatus, ServiceResponse } from '@common/models/serviceResponse';
import { getEnvVar } from '@common/utils/envConfig';
import { googleAuth } from '@lib/googleAuth';
import { User } from '@modules/user/userModel';
import { userRepository } from '@modules/user/userRepository';
import { logger } from '@src/server';

export const recordService = {
  getGoogleSheetClient: () => {
    return google.sheets({ version: 'v4', auth: googleAuth });
  },
  readGoogleSheet: async ({ spreadsheetId, range }: { spreadsheetId: string; range: string }) => {
    const googleSheetClient = recordService.getGoogleSheetClient();

    const result = await googleSheetClient.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return result.data.values;
  },
  writeGoogleSheet: async ({
    spreadsheetId,
    range,
    values,
  }: {
    spreadsheetId: string;
    range: string;
    values: any;
  }) => {
    const googleSheetClient = recordService.getGoogleSheetClient();
    await googleSheetClient.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        majorDimension: 'ROWS',
        values,
      },
    });
  },
  getCommitMessages: async () => {
    const api = new Gitlab({
      token: getEnvVar<string>('GITLAB_ACCESS_TOKEN', 'string'),
    });

    const branches = await api.Branches.all(43738396);
    const messages = [];
    for (const branch of branches) {
      const commits = await api.Commits.all(43738396, {
        ref_name: branch.name,
        since: new Date('2024-01-26').toDateString(), // Filter commits from today
      });

      if (commits.length === 0) continue;

      const commitMessages = commits.map((commit) => commit.message);

      messages.push(...commitMessages);
    }
    return messages;
  },
  getSummarizeMessage: async (commitMessages: string[]) => {
    const openai = new OpenAI({
      apiKey: getEnvVar<string>('OPENAI_API_KEY', 'string'),
    });
    const promptText = `Here is the commit messages: '${commitMessages.join(',')}'`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a developer working on a team project.',
        },
        {
          role: 'user',
          content:
            "Generate a summary message, including an array of commit messages, with each message's content between 30 to 50 words, containing only the summary content",
        },
        {
          role: 'user',
          content: promptText,
        },
      ],
      max_tokens: 150, // Adjust the summary length as needed
      temperature: 0, // Adjust the temperature to control randomness, higher values make it more random
      top_p: 1.0, // Adjust the top-p value to control the diversity of generated text
      n: 1, // Generate only one output sequence
    });

    if (!completion || !completion.choices || completion.choices.length === 0) {
      return new ServiceResponse(
        ResponseStatus.Failed,
        'Failed to generate a completion.',
        null,
        StatusCodes.NOT_FOUND
      );
    }

    const summary = completion.choices[0]?.message.content;

    return summary?.replace('Summary message:', '').trim();
  },
  // Retrieves all users from the database
  findAll: async (): Promise<ServiceResponse<User[] | null>> => {
    try {
      const users = await userRepository.findAllAsync();
      if (!users) {
        return new ServiceResponse(
          ResponseStatus.Failed,
          'No Users found',
          null,
          StatusCodes.NOT_FOUND
        );
      }
      return new ServiceResponse<User[]>(
        ResponseStatus.Success,
        'Users found',
        users,
        StatusCodes.OK
      );
    } catch (ex) {
      const errorMessage = `Error finding all users: $${(ex as Error).message}`;
      logger.error(errorMessage);
      return new ServiceResponse(
        ResponseStatus.Failed,
        errorMessage,
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  },

  // Retrieves a single user by their ID
  findById: async (id: number): Promise<ServiceResponse<User | null>> => {
    try {
      const user = await userRepository.findByIdAsync(id);
      if (!user) {
        return new ServiceResponse(
          ResponseStatus.Failed,
          'User not found',
          null,
          StatusCodes.NOT_FOUND
        );
      }
      return new ServiceResponse<User>(ResponseStatus.Success, 'User found', user, StatusCodes.OK);
    } catch (ex) {
      const errorMessage = `Error finding user with id ${id}:, ${(ex as Error).message}`;
      logger.error(errorMessage);
      return new ServiceResponse(
        ResponseStatus.Failed,
        errorMessage,
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  },
};
