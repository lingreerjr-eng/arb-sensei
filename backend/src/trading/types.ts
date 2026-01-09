export type OrderSide = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'cancelled' | 'failed';

export interface Order {
  id: string;
  marketId: string;
  side: OrderSide;
  outcome: 'yes' | 'no';
  amount: number;
  price: number;
  type: OrderType;
  status: OrderStatus;
  filledAmount?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PlaceOrderParams {
  marketId: string;
  side: OrderSide;
  outcome: 'yes' | 'no';
  amount: number;
  price: number;
  type?: OrderType;
}

export interface CancelOrderParams {
  orderId: string;
  marketId?: string;
}

export interface Position {
  marketId: string;
  outcome: 'yes' | 'no';
  size: number;
  averagePrice: number;
}

