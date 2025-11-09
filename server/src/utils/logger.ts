import winston from 'winston';

const { combine, timestamp, errors, printf, colorize } = winston.format;

// 自定义格式
const customFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      )
    })
  ]
});

// 添加便捷方法
export const logError = (message: string, error?: any) => {
  if (error instanceof Error) {
    logger.error(message, { error: error.message, stack: error.stack });
  } else {
    logger.error(message, { error: JSON.stringify(error, null, 2) });
  }
};

export const logApiRequest = (method: string, url: string, statusCode?: number) => {
  const level = statusCode && statusCode >= 400 ? 'error' : 'info';
  logger.log(level, `API ${method} ${url}`, { statusCode });
};

export const logAiRequest = (service: string, model: string, responseTime?: number) => {
  logger.info(`AI Request: ${service} (${model})`, { responseTime: responseTime ? `${responseTime}ms` : 'pending' });
};
