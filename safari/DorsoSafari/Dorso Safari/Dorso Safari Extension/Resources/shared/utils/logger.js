/**
 * Structured logging utility for browser extensions.
 * Provides consistent logging across Chrome and Firefox.
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

class Logger {
    constructor(context = 'dorso') {
        this.context = context;
        this.level = LOG_LEVELS.INFO;
    }

    setLevel(level) {
        if (LOG_LEVELS[level] !== undefined) {
            this.level = LOG_LEVELS[level];
        }
    }

    _log(level, message, data = {}) {
        if (LOG_LEVELS[level] < this.level) {
            return;
        }

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            context: this.context,
            message,
            ...data,
        };

        const consoleMethod = level === 'ERROR' ? 'error' :
                            level === 'WARN' ? 'warn' :
                            level === 'DEBUG' ? 'debug' : 'log';

        console[consoleMethod](`[${timestamp}] [${level}] [${this.context}]`, message, data);

        if (level === 'ERROR') {
            this._dropRemoteLog(logEntry);
        }
    }

    debug(message, data) {
        this._log('DEBUG', message, data);
    }

    info(message, data) {
        this._log('INFO', message, data);
    }

    warn(message, data) {
        this._log('WARN', message, data);
    }

    error(message, data) {
        this._log('ERROR', message, data);
    }

    async _dropRemoteLog(_logEntry) {
        return;
    }
}

export default new Logger('dorso');
export { Logger };
