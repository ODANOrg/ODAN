
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
}

const colors = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
};

function formatLog(log: LogMessage): string {
  const { level, message, timestamp, context, data } = log;
  const color = colors[level];
  const contextStr = context ? `[${context}] ` : '';
  const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  
  return `${color}[${timestamp}] [${level.toUpperCase()}]${colors.reset} ${contextStr}${message}${dataStr}`;
}

function createLog(level: LogLevel, message: string, context?: string, data?: unknown): void {
  const log: LogMessage = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    data,
  };

  const formatted = formatLog(log);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, context?: string, data?: unknown) => 
    createLog('debug', message, context, data),
  
  info: (message: string, context?: string, data?: unknown) => 
    createLog('info', message, context, data),
  
  warn: (message: string, context?: string, data?: unknown) => 
    createLog('warn', message, context, data),
  
  error: (message: string, context?: string, data?: unknown) => 
    createLog('error', message, context, data),
};

export function createContextLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) => logger.debug(message, context, data),
    info: (message: string, data?: unknown) => logger.info(message, context, data),
    warn: (message: string, data?: unknown) => logger.warn(message, context, data),
    error: (message: string, data?: unknown) => logger.error(message, context, data),
  };
}

export default logger;
