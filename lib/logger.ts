// Fichier: /DockerFlow/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logToConsole(level: LogLevel, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, ...args);
        break;
      case 'info':
        console.info(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        break;
      case 'error':
        console.error(formattedMessage, ...args);
        break;
    }
  }

  debug(message: string, ...args: any[]) {
    this.logToConsole('debug', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.logToConsole('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.logToConsole('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.logToConsole('error', message, ...args);
  }
}

export const logger = new Logger();