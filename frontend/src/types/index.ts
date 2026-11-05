export type UserRole = 'founder' | 'investor' | 'normal';

export interface User {
  id: string; // UUID v4
  email: string;
  full_name: string;
  role: UserRole;
  country_code: string;
  phone_number: string;
  created_at?: number;
}

export type StartupStatus = 'PITCHING' | 'AUCTION_ACTIVE' | 'FUNDED' | 'CLOSED';

export interface StartupInterest {
  id: string;
  startup_id: string;
  investor_id: string;
  investor_name?: string;
  investor_email?: string;
  note?: string;
  created_at: number;
}

export type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface AuctionBid {
  id: string;
  startup_id: string;
  investor_id: string;
  investor_name?: string;
  investor_phone?: string;
  bid_amount: number;
  equity_demanded: number;
  conditions: string;
  status: BidStatus;
  created_at: number;
}

export interface Startup {
  id: string; // UUID v4
  founder_id: string;
  founder_name?: string;
  title: string;
  industry: string;
  pitch: string;
  funding_target: number;
  equity_offered: number;
  min_investor_threshold: number;
  status: StartupStatus;
  selected_investor_id?: string | null;
  selected_investor_name?: string | null;
  created_at: number;
  interest_count: number;
  user_has_interested?: boolean;
  interests?: StartupInterest[];
  bids?: AuctionBid[];
}

export interface Product {
  id: string; // UUID v4
  vendor_id: string;
  vendor_name?: string;
  vendor_phone?: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  stock: number;
  created_at: number;
}

export interface ProductInquiry {
  id: string;
  product_id: string;
  product_title?: string;
  buyer_id: string;
  buyer_name: string;
  buyer_phone: string;
  message: string;
  status: 'PENDING' | 'RESOLVED';
  created_at: number;
}

export type NotificationType =
  | 'INTEREST'
  | 'AUCTION_STARTED'
  | 'BID_PLACED'
  | 'BID_ACCEPTED'
  | 'BID_REJECTED'
  | 'PRODUCT_INQUIRY';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: number;
}

