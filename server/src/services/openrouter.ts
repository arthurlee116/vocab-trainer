import { ProxyAgent } from 'undici';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';
import { logError, logAiRequest } from '../utils/logger';

type ContentBlock =
  | string
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image_url';
      image_url: {
        url: string;
      };
    };

interface ChatRequestBody {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: ContentBlock | ContentBlock[];
  }>;
  response_format?: Record<string, unknown>;
  temperature?: number;
  max_output_tokens?: number;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

interface OpenRouterOptions {
  dispatcher?: any; // Optional dispatcher (e.g., ProxyAgent) for bypassing geo-restrictions
}

const defaultProxyAgent = env.openRouterProxy ? new ProxyAgent(env.openRouterProxy) : undefined;

export const openRouterChat = async <T = unknown>(
  payload: ChatRequestBody,
  options?: OpenRouterOptions
): Promise<T> => {
  const modelName = payload.model;
  const startTime = Date.now();

  const fetchOptions: Record<string, any> = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.openRouterReferer,
      'X-Title': env.openRouterTitle
    },
    body: JSON.stringify({
      ...payload,
      stream: false
    })
  };

  const dispatcher = options?.dispatcher ?? defaultProxyAgent;
  if (dispatcher) {
    fetchOptions.dispatcher = dispatcher;
  }

  try {
    logAiRequest('OpenRouter', modelName);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', fetchOptions);
    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `OpenRouter API error: ${response.status} - ${errorText}`;
      logError(errorMsg, { status: response.status, response: errorText, model: modelName });
      throw new HttpError(response.status, errorText || 'OpenRouter request failed');
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      const errorMsg = `Model returned empty response from ${modelName}`;
      logError(errorMsg, { model: modelName, data });
      throw new HttpError(500, 'Model returned empty response');
    }

    try {
      const result = JSON.parse(content) as T;
      const responseTime = Date.now() - startTime;
      logAiRequest('OpenRouter', modelName, responseTime);
      return result;
    } catch (parseError) {
      const errorMsg = `Failed to parse structured response from ${modelName}`;
      logError(errorMsg, {
        model: modelName,
        content: content.substring(0, 500),
        parseError: parseError instanceof Error ? parseError.message : parseError
      });
      throw new HttpError(500, 'Unable to parse structured response from model');
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    if (error instanceof HttpError) {
      throw error;
    }
    const unexpectedError = error instanceof Error ? error : new Error(String(error));
    logError(`Unexpected error in OpenRouter request to ${modelName}`, {
      error: unexpectedError.message,
      stack: unexpectedError.stack,
      responseTime
    });
    throw new HttpError(500, `OpenRouter request failed: ${unexpectedError.message}`);
  }
};
