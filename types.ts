export type TenantRole = 'owner' | 'accountant' | 'sales' | 'super_admin';

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
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ProductForm {
  name: string;
  category: string;
  price: string;
  stock: string;
  notes?: string;
}
