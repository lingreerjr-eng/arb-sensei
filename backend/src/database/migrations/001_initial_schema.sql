-- Create enum types
CREATE TYPE platform_type AS ENUM ('opinion', 'polymarket');
CREATE TYPE trade_side AS ENUM ('yes', 'no');
CREATE TYPE trade_status AS ENUM ('pending', 'filled', 'cancelled', 'failed');
CREATE TYPE opportunity_status AS ENUM ('detected', 'executing', 'executed', 'expired');

-- Market mappings table
CREATE TABLE IF NOT EXISTS market_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_market_id VARCHAR(255) UNIQUE NOT NULL,
    opinion_market_id VARCHAR(255),
    polymarket_market_id VARCHAR(255),
    market_title VARCHAR(500) NOT NULL,
    similarity_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT at_least_one_market CHECK (
        opinion_market_id IS NOT NULL OR polymarket_market_id IS NOT NULL
    )
);

-- Arbitrage opportunities table
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_market_id VARCHAR(255) NOT NULL REFERENCES market_mappings(canonical_market_id),
    combined_cost DECIMAL(10, 6) NOT NULL,
    profit_potential DECIMAL(10, 6) NOT NULL,
    opinion_price_yes DECIMAL(10, 6),
    opinion_price_no DECIMAL(10, 6),
    polymarket_price_yes DECIMAL(10, 6),
    polymarket_price_no DECIMAL(10, 6),
    liquidity_opinion DECIMAL(15, 2),
    liquidity_polymarket DECIMAL(15, 2),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status opportunity_status DEFAULT 'detected',
    expires_at TIMESTAMP,
    CONSTRAINT valid_combined_cost CHECK (combined_cost >= 0 AND combined_cost <= 1)
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arbitrage_opportunity_id UUID REFERENCES arbitrage_opportunities(id),
    platform platform_type NOT NULL,
    market_id VARCHAR(255) NOT NULL,
    side trade_side NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    price DECIMAL(10, 6) NOT NULL,
    order_id VARCHAR(255),
    status trade_status DEFAULT 'pending',
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    CONSTRAINT positive_amount CHECK (amount > 0),
    CONSTRAINT valid_price CHECK (price >= 0 AND price <= 1)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_mappings_canonical ON market_mappings(canonical_market_id);
CREATE INDEX IF NOT EXISTS idx_market_mappings_opinion ON market_mappings(opinion_market_id);
CREATE INDEX IF NOT EXISTS idx_market_mappings_polymarket ON market_mappings(polymarket_market_id);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_canonical ON arbitrage_opportunities(canonical_market_id);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_status ON arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_detected ON arbitrage_opportunities(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_opportunity ON trades(arbitrage_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_trades_platform ON trades(platform);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_executed ON trades(executed_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for market_mappings
CREATE TRIGGER update_market_mappings_updated_at
    BEFORE UPDATE ON market_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

