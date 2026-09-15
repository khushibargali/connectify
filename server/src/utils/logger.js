const silent = process.env.NODE_ENV === 'test';
const stamp = () => new Date().toISOString();

const logger = {
  info: (...args) => !silent && console.log(stamp(), '[info] ', ...args),
  warn: (...args) => !silent && console.warn(stamp(), '[warn] ', ...args),
  error: (...args) => !silent && console.error(stamp(), '[error]', ...args),
};

export default logger;
