const timestamp = () => new Date().toISOString();

const logger = {
  info: (msg: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`${timestamp()} [INFO] ${msg}${metaStr}`);
  },
  warn: (msg: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.warn(`${timestamp()} [WARN] ${msg}${metaStr}`);
  },
  error: (msg: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.error(`${timestamp()} [ERROR] ${msg}${metaStr}`);
  },
  debug: (msg: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.debug(`${timestamp()} [DEBUG] ${msg}${metaStr}`);
  },
};

export default logger;
