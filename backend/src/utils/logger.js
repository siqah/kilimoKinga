const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 2;

const colors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
};

function log(level, ...args) {
  if (LEVELS[level] > currentLevel) return;
  const ts = new Date().toISOString().slice(11, 23);
  const c = colors[level] || '';
  console.log(`${colors.debug}${ts}${colors.reset} ${c}[${level.toUpperCase()}]${colors.reset}`, ...args);
}

const logger = {
  error: (...args) => log('error', ...args),
  warn: (...args) => log('warn', ...args),
  info: (...args) => log('info', ...args),
  debug: (...args) => log('debug', ...args),
};

export default logger;
