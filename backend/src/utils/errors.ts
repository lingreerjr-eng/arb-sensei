export class ArbitrageError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ArbitrageError';
    Object.setPrototypeOf(this, ArbitrageError.prototype);
  }
}

export class WebSocketError extends ArbitrageError {
  constructor(message: string, code: string = 'WS_ERROR') {
    super(message, code, 500);
    this.name = 'WebSocketError';
  }
}

export class TradingError extends ArbitrageError {
  constructor(message: string, code: string = 'TRADING_ERROR') {
    super(message, code, 500);
    this.name = 'TradingError';
  }
}

export class MarketMatchingError extends ArbitrageError {
  constructor(message: string, code: string = 'MATCHING_ERROR') {
    super(message, code, 400);
    this.name = 'MarketMatchingError';
  }
}

export class DatabaseError extends ArbitrageError {
  constructor(message: string, code: string = 'DB_ERROR') {
    super(message, code, 500);
    this.name = 'DatabaseError';
  }
}

