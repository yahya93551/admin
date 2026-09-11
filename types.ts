export type TenantRole = 'owner' | 'accountant' | 'sales' | 'admin' | 'super_admin';

export type SubscriptionPlan = 'basic' | 'pro' | 'unlimited';

export type SubscriptionStatus = 'active' | 'inactive' | 'pending' | 'expired' | 'declined';

export interface Subscription {
  id: string;
  tenant_id: string;
  status: SubscriptionStatus | string;
  plan?: SubscriptionPlan | null;
  subscription_duration_months?: number | null;
  monthly_fee: number | string | null;
  billing_date?: string | null;
  next_billing_date?: string | null;
  active_until?: string | null;
  requested_at: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface TenantContext {
  tenant_id: string;
  role: TenantRole;
  user_id: string;
  user_email: string;
  isGlobalAdmin?: boolean;
}

export interface Product {
  id: string;
  tenant_id: string;
  user_id: string;
  created_by: string;
  name: string;
  category: string;
  price: number | string;
  stock: number;
  notes?: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  user_id: string;
  created_by: string;
  name: string;
  created_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  role: TenantRole;
  active: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  tenant_id: string;
  performed_by: string;
  performed_by_email?: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  http_method?: string | null;
  endpoint?: string | null;
  status_code?: number | null;
  created_at: string;
}

export interface UserActivitySummary {
  user_id: string;
  user_email: string | null;
  activity_count: number;
}

export interface ProductForm {
  name: string;
  category: string;
  price: string;
  stock: string;
  notes?: string;
}
