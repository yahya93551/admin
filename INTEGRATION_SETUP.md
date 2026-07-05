# Admin + Inventory Integration Setup

## Overview
The admin project has been configured to manage users and roles in the iventorybackup system. The new "admin" role has been added only to the database migrations, keeping your iventorybackup code completely untouched.

## What Was Changed

### 1. **iventorybackup Project** (Database Only - No Code Changes)
**File:** `supabase/migrations/20260530000001_add_admin_role.sql`
- Created a new migration that adds 'admin' to the allowed roles
- Modified the `tenant_members` table CHECK constraint to include: `'owner', 'accountant', 'sales', 'admin'`
- ✅ **Zero changes to iventorybackup code**

### 2. **admin Project** (New Features)

#### API Endpoints Created:

**a) `/api/admin/inventory-users` (GET/POST)**
- **GET:** Lists all tenant members from iventorybackup
- **POST:** Manages user roles (assign-role, activate, deactivate)

**b) `/api/admin/inventory-users/invite` (POST)**
- Invites new users to inventory tenants
- Creates auth users if they don't exist
- Assigns specified roles to users

#### UI Component:
**File:** `components/InventoryUsersManager.tsx`
- New component for managing inventory users
- Features:
  - List all users with their roles and status
  - Invite new users to the system
  - Assign/update user roles
  - Activate/deactivate users
  - Tenant selection when inviting

#### Admin Dashboard Update:
**File:** `app/admin/page.tsx`
- Added new "Inventory Users" section in admin navigation
- Integrated InventoryUsersManager component
- Accessible via the admin dashboard

## Setup Instructions

### 1. Apply the Migration
```bash
cd iventorybackup
# Push the migration to Supabase
npx supabase db push
```

### 2. Verify Environment Variables
Make sure your admin project has these in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://vnbwdjwcporkjwzlblzm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Test the Integration

**Step 1:** Start the admin project
```bash
cd admin
npm run dev
```

**Step 2:** Navigate to `/admin` in your browser

**Step 3:** Click on the "Inventory Users" tab

**Step 4:** Test the features:
- View existing users
- Click "Invite User" to add a new user
- Select a tenant, enter email and role
- Manage user roles and status

## How It Works

### User Management Flow:

1. **Inviting a User:**
   - Admin clicks "Invite User"
   - Fills in: Tenant, Email, Name (optional), Role
   - System creates auth user if needed
   - User is added to tenant_members with specified role

2. **Role Management:**
   - Admin can change a user's role directly
   - Changes update the tenant_members table
   - RLS policies will respect the new role

3. **Role Access Control:**
   - **owner**: Full access, can manage all data and users
   - **accountant**: Can manage products and inventory
   - **sales**: Can record sales transactions
   - **admin**: System-level admin (new role) - has owner-like permissions

## Backward Compatibility

✅ **No breaking changes:**
- Existing users (owner, accountant, sales) work exactly as before
- All existing code in iventorybackup is unchanged
- New admin role is optional - only used if explicitly assigned
- RLS policies automatically support the new role without modification

## Database Changes Summary

Only one migration file was added to iventorybackup:
- Added 'admin' to role validation CHECK constraint
- No data migration needed
- No table structure changes
- Safe to rollback if needed

## Testing Checklist

- [ ] Apply migration successfully
- [ ] Admin dashboard loads without errors
- [ ] Can view inventory users list
- [ ] Can invite new user
- [ ] Can assign 'admin' role to users
- [ ] Can activate/deactivate users
- [ ] Original inventory app features work unchanged

## Important Notes

⚠️ **Security Considerations:**
1. The admin project uses `supabaseAdmin` (service role) for API operations
2. Ensure proper authentication checks before deploying to production
3. Consider adding rate limiting and audit logging
4. Restrict API endpoints to authorized admins only

## Rollback Instructions (If Needed)

If you need to remove the admin role:
```sql
-- Remove admin role and revert to original roles
ALTER TABLE tenant_members
DROP CONSTRAINT tenant_members_role_check;

ALTER TABLE tenant_members
ADD CONSTRAINT tenant_members_role_check CHECK (role IN ('owner', 'accountant', 'sales'));

-- Users with 'admin' role will need to be reassigned to a valid role
UPDATE tenant_members SET role = 'owner' WHERE role = 'admin';
```

## File Reference

### Created Files:
1. `iventorybackup/supabase/migrations/20260530000001_add_admin_role.sql`
2. `admin/app/api/admin/inventory-users/route.ts`
3. `admin/app/api/admin/inventory-users/invite/route.ts`
4. `admin/components/InventoryUsersManager.tsx`

### Modified Files:
1. `admin/app/admin/page.tsx` - Added inventory section to dashboard

## Support

If you encounter issues:
1. Check Supabase logs for any database errors
2. Verify all environment variables are set correctly
3. Ensure both projects are using the same Supabase project
4. Check browser console for any client-side errors

---
**Setup Date:** May 30, 2026
**Status:** Ready for testing
