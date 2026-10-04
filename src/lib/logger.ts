export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private maxBufferSize: number = 100; // Max log entries to buffer before force flush
  private isElectron: boolean = false;

  constructor() {
    // Check if we're in Electron environment
    this.isElectron = typeof window !== 'undefined' && window.electronAPI != null;
    
    // Initialize log path if in Electron
    if (this.isElectron) {
      this.initializeLogging();
    }
  }

  private async initializeLogging(): Promise<void> {
    try {
      const logPath = await window.electronAPI?.getLogPath();
      this.log('INFO', 'LOGGER', `Logger initialized - log path: ${logPath}`);
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  private formatEntry(entry: LogEntry): string {
    const data = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
    return `[${entry.timestamp}] ${entry.level} [${entry.category}] ${entry.message}${data}\n`;
  }

  private async flushBuffer(): Promise<void> {
    if (!this.isElectron || this.buffer.length === 0) return;

    try {
      const result = await window.electronAPI?.writeLogs(this.buffer);
      if (result?.success) {
        this.buffer = [];
      } else {
        console.error('Failed to write logs:', result?.error);
        // Keep buffer if write failed - will retry on next flush
      }
    } catch (error) {
      console.error('Failed to write logs:', error);
      // Keep buffer if write failed - will retry on next flush
    }
  }

  private scheduleFlush(): void {
    // Force flush if buffer is getting too large
    if (this.buffer.length >= this.maxBufferSize) {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
      this.flushBuffer();
      return;
    }

    if (this.flushTimer) return;
    
    this.flushTimer = setTimeout(async () => {
      await this.flushBuffer();
      this.flushTimer = null;
    }, 2000); // Flush every 2 seconds
  }

  log(level: LogEntry['level'], category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data
    };

    const formattedEntry = this.formatEntry(entry);
    
    if (this.isElectron) {
      this.buffer.push(formattedEntry);
      this.scheduleFlush();
    }

    // Also log to console in development or when not in Electron
    const isDevelopment = typeof import !== 'undefined' && import.meta.env?.DEV === true;
    if (isDevelopment || !this.isElectron) {
      const logFn = level === 'ERROR' ? console.error : 
                   level === 'WARN' ? console.warn : console.log;
      logFn(`[${category}] ${message}`, data || '');
    }
  }

  info(category: string, message: string, data?: any): void {
    this.log('INFO', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log('WARN', category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log('ERROR', category, message, data);
  }

  debug(category: string, message: string, data?: any): void {
    this.log('DEBUG', category, message, data);
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushBuffer();
  }
}

export const logger = new Logger();