const timestamp = () => new Date().toISOString();

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const getCurrentLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (
    envLevel === "debug" ||
    envLevel === "info" ||
    envLevel === "warn" ||
    envLevel === "error"
  ) {
    return envLevel;
  }
  return "info";
};

const shouldLog = (messageLevel: LogLevel): boolean => {
  const currentLevel = getCurrentLogLevel();
  return LOG_LEVELS[messageLevel] >= LOG_LEVELS[currentLevel];
};

const logger = {
  info: (msg: string, meta?: unknown) => {
    if (!shouldLog("info")) return;
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`${timestamp()} [INFO] ${msg}${metaStr}`);
  },
  warn: (msg: string, meta?: unknown) => {
    if (!shouldLog("warn")) return;
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.warn(`${timestamp()} [WARN] ${msg}${metaStr}`);
  },
  error: (msg: string, meta?: unknown) => {
    if (!shouldLog("error")) return;
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.error(`${timestamp()} [ERROR] ${msg}${metaStr}`);
  },
  debug: (msg: string, meta?: unknown) => {
    if (!shouldLog("debug")) return;
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.debug(`${timestamp()} [DEBUG] ${msg}${metaStr}`);
  },
};

export default logger;
