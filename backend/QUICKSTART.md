# Quick Start Guide

## Prerequisites

1. **PostgreSQL Database**
   ```bash
   # Install PostgreSQL and create database
   createdb arb_sensei
   ```

2. **Node.js and npm**
   ```bash
   node --version  # Should be 18+
   npm --version
   ```

3. **API Keys**
   - Opinion.trade API key and private key
   - Polymarket API key and private key

## Installation Steps

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run Database Migrations**
   ```bash
   npm run build
   npm run migrate
   ```

4. **Start the Server**
   ```bash
   npm start
   # Or for development:
   npm run dev
   ```

## Testing the Setup

1. **Check Health Endpoint**
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Sync Markets**
   ```bash
   curl -X POST http://localhost:3001/api/markets/sync
   ```

3. **View Matched Markets**
   ```bash
   curl http://localhost:3001/api/markets
   ```

4. **Run Example Script**
   ```bash
   npm run build
   node dist/examples/detect-arb.js
   ```

## WebSocket Connection

Connect to the WebSocket server from your frontend:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'arbitrage_opportunity') {
    console.log('Arbitrage detected!', message.data);
  }
};
```

## Important Notes

1. **Polymarket CLOB Client**: The `@polymarket/clob-client` package may need adjustment based on the actual package API. Check the Polymarket documentation for the correct package name and usage.

2. **Opinion API**: Adjust API endpoints in `opinionClient.ts` and `opinionTrader.ts` based on actual Opinion.trade API documentation.

3. **Testnet First**: Always test with testnet/sandbox endpoints before using real funds.

4. **Security**: Never commit `.env` file or expose API keys in code.

## Troubleshooting

- **Database Connection Error**: Ensure PostgreSQL is running and DATABASE_URL is correct
- **WebSocket Connection Failed**: Check API keys and endpoints
- **No Markets Matched**: Adjust similarity threshold in `marketMatcher.ts` if needed
- **No Arbitrage Detected**: Check that markets are properly matched and prices are updating

