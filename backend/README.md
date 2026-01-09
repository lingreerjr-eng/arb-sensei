# Arbitrage Sensei Backend

Backend service for prediction market arbitrage detection between Opinion.trade and Polymarket.

## Features

- Real-time WebSocket connections to Opinion.trade and Polymarket
- Market matching using string similarity and semantic analysis
- Continuous arbitrage detection (side1 + side2 < 0.98)
- CLOB trading integration for both platforms
- Atomic trade execution with safety checks
- REST API and WebSocket server for frontend integration
- PostgreSQL database for market mappings and trade history

## Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- API keys for Opinion.trade and Polymarket

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys and database URL
```

3. Run database migrations:
```bash
npm run migrate
```

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## Configuration

Key environment variables:

- `OPINION_WS_URL` - Opinion WebSocket endpoint
- `OPINION_API_KEY` - Opinion API key
- `OPINION_PRIVATE_KEY` - Opinion private key
- `POLYMARKET_WS_URL` - Polymarket WebSocket endpoint
- `POLYMARKET_API_KEY` - Polymarket API key
- `POLYMARKET_PRIVATE_KEY` - Polymarket private key
- `DATABASE_URL` - PostgreSQL connection string
- `ARB_THRESHOLD` - Combined cost threshold (default: 0.98)
- `MIN_LIQUIDITY` - Minimum liquidity required
- `AUTO_EXECUTE` - Enable/disable auto-execution (default: false)
- `MAX_POSITION_SIZE` - Maximum trade size

## API Endpoints

### REST API

- `GET /api/health` - Health check
- `GET /api/opportunities` - List recent arbitrage opportunities
- `GET /api/opportunities/active` - Get active opportunities
- `GET /api/markets` - List matched markets
- `POST /api/markets/sync` - Sync markets from both platforms
- `GET /api/trades` - Trade history
- `POST /api/execute/:opportunityId` - Execute arbitrage opportunity
- `GET /api/config` - Get configuration
- `POST /api/config` - Update configuration

### WebSocket

Connect to `ws://localhost:3001/ws` for real-time updates:

- `arbitrage_opportunity` - New arbitrage opportunity detected
- `market_update` - Market data updates
- `execution_success` - Trade execution succeeded
- `execution_failed` - Trade execution failed

## Testing

Run unit tests:
```bash
npm test
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (Existing UI)          │
└──────────────────┬──────────────────────┘
                   │ WebSocket / REST API
┌──────────────────▼──────────────────────┐
│      Backend Service (Node.js/TS)        │
├──────────────────────────────────────────┤
│  Opinion WS  │  Polymarket WS  │ Matcher│
│      │              │              │     │
│      └──────────────┼──────────────┘     │
│                     │                    │
│            Arbitrage Detector            │
│                     │                    │
│      ┌──────────────┼──────────────┐     │
│      │              │              │     │
│  Opinion CLOB  Polymarket CLOB  Executor│
│                                            │
│         PostgreSQL Database                │
└────────────────────────────────────────────┘
```

## Safety Features

- Position size limits
- Liquidity validation
- Atomic trade execution (both legs or neither)
- Automatic order cancellation on failure
- Comprehensive error handling and logging
- Circuit breakers for rapid-fire trades

## Notes

- Always test with testnet/sandbox endpoints before using real funds
- Monitor logs for errors and connection issues
- Adjust similarity thresholds in market matching as needed
- Review and adjust fee rates in calculator based on actual platform fees

