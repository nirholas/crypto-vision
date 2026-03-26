type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function log(level: LogLevel, context: Record<string, unknown> | string, message?: string) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

  let ctx: Record<string, unknown>;
  let msg: string;

  if (typeof context === 'string') {
    ctx = {};
    msg = context;
  } else {
    ctx = context;
    msg = message ?? '';
  }

  const entry = {
    level,
    msg,
    time: new Date().toISOString(),
    ...ctx,
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  debug: (ctx: Record<string, unknown> | string, msg?: string) => log('debug', ctx, msg),
  info: (ctx: Record<string, unknown> | string, msg?: string) => log('info', ctx, msg),
  warn: (ctx: Record<string, unknown> | string, msg?: string) => log('warn', ctx, msg),
  error: (ctx: Record<string, unknown> | string, msg?: string) => log('error', ctx, msg),
};
