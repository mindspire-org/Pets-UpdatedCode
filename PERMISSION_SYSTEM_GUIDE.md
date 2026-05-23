# Complete User Permission System Guide

## Overview

This system provides comprehensive user management with granular permissions for portal access and sidebar page visibility. **Users are created with NO permissions by default** and must be explicitly granted access through the Sidebar Permissions page.

## Key Features

### 1. **Explicit Permission Model**
- **New users get NO permissions by default** (except admin users)
- All permissions must be explicitly granted through the admin interface
- No automatic portal access based on role
- Admin users automatically get full access to all portals and pages

### 2. **Role-Based Structure**
- Users have roles: `admin`, `reception`, `doctor`, `lab`, `pharmacy`, `shop`
- Roles are used for organization and login validation
- Roles do NOT automatically grant permissions (except admin)

### 3. **Portal Access Control**
- Users must be granted access to specific portals
- Portal access is required before page permissions can be set
- Available portals: `admin`, `reception`, `doctor`, `lab`, `pharmacy`, `shop`

### 4. **Granular Page Permissions**
- Within each portal, users can be granted access to specific sidebar pages
- Page permissions are enforced in the UI (sidebar filtering)
- Pages without permission are hidden from the user

### 5. **Dynamic Sidebar Generation**
- Sidebars are generated from database configuration
- Permissions filter which pages are shown
- Consistent across all portals

## New Workflow (Updated)

### Step 1: Create a User

1. Go to **Admin Portal** → **User Management** → **Users**
2. Click **"Add User"**
3. Fill in user details:
   - **Name**: Full name of the user
   - **Email**: Email address
   - **Role**: Select appropriate role (pharmacy, reception, etc.)
   - **Username**: Unique username for login
   - **Password**: Login password
4. Click **"Add User"**

**What happens now:**
- User is created with **NO permissions** (empty portal access and page permissions)
- User **CANNOT login** to any portal until permissions are granted
- Only admin users get automatic full access

### Step 2: Grant Permissions (Required)

1. Go to **Admin Portal** → **User Management** → **Sidebar Permissions**
2. Select the newly created user from the left panel
3. You'll see a warning: "No permissions set - use Quick Setup or configure manually"
4. **Option A - Quick Setup** (Recommended):
   - Click **"Quick Setup"** button
   - This grants default permissions based on the user's role
   - User gets access to their role's portal and all standard pages
5. **Option B - Manual Setup**:
   - Configure **Portal Access**: Toggle which portals the user can access
   - Configure **Page Permissions**: Toggle individual pages within each portal
6. Click **"Save Changes"**

### Step 3: User Can Now Login

After permissions are granted:
1. User can login to their assigned portals
2. They only see portals they have access to
3. Within each portal, they only see pages they have permission for
4. If they try to access a restricted portal/page, they see an access denied message

## Example Scenarios

### Scenario 1: Create Pharmacy User "Daniyal"

**Step 1 - Create User:**
```
Name: Daniyal
Role: Pharmacy  
Username: daniyal
Password: (set password)
```
**Result:** User created with NO permissions, cannot login yet.

**Step 2 - Grant Permissions:**
- Go to Sidebar Permissions → Select "Daniyal"
- Click "Quick Setup" (gives full pharmacy access)
- OR manually grant:
  - Portal Access: ✅ Pharmacy Portal
  - Page Permissions: ✅ Dashboard, ✅ Point of Sale (only these 2)
- Click "Save Changes"

**Step 3 - User Experience:**
- Daniyal can now login to pharmacy portal
- Sees only Dashboard and POS in sidebar (if manual setup)
- All other pharmacy pages are hidden

### Scenario 2: Multi-Portal Manager

**Step 1 - Create User:**
```
Name: Manager
Role: Admin (or any role)
Username: manager
```

**Step 2 - Grant Permissions:**
- Portal Access: ✅ Admin Portal, ✅ Pharmacy Portal
- Configure page permissions for each portal as needed

**Result:** Manager can access both admin and pharmacy portals with specified pages.

## Key Changes from Previous Version

### ❌ Old Behavior (Automatic)
- User with "pharmacy" role → Automatic pharmacy portal access + all pharmacy pages
- Role determined permissions automatically
- Users could login immediately after creation

### ✅ New Behavior (Explicit)
- User with "pharmacy" role → **NO permissions** until explicitly granted
- Role is just a label, doesn't grant permissions (except admin)
- Users **cannot login** until admin grants portal access
- **Quick Setup** button available for convenience

## Security Benefits

### 1. **Principle of Least Privilege**
- Users start with zero access
- Must explicitly grant each permission
- No accidental over-privileging

### 2. **Explicit Control**
- Admin must consciously decide what each user can access
- No assumptions based on role names
- Clear audit trail of permission grants

### 3. **Flexible Assignment**
- Can give pharmacy role user access to multiple portals
- Can restrict admin role user to specific pages
- Role doesn't limit permission possibilities

## Admin User Exception

**Admin users are the only exception:**
- Admin role users automatically get full access to all portals and pages
- This ensures there's always a way to manage the system
- Admin permissions cannot be restricted

## Quick Setup Feature

The **Quick Setup** button provides convenience while maintaining security:

- **What it does**: Applies role-based default permissions
- **When to use**: For standard users who need typical access for their role
- **Pharmacy Quick Setup gives**:
  - Portal Access: `['pharmacy']`
  - All pharmacy pages: dashboard, pos, medicines, suppliers, etc.
- **Reception Quick Setup gives**:
  - Portal Access: `['reception']`  
  - All reception pages: dashboard, pets, clients, appointments, etc.

## Troubleshooting

### User Can't Login
**Most common issue**: User has no portal access
**Solution**: 
1. Go to Sidebar Permissions
2. Select the user
3. Grant portal access first
4. Then grant page permissions
5. Save changes

### User Sees "Access Denied" 
**Issue**: User has role but no portal permissions
**Solution**: Use Quick Setup or manually grant portal access

### User Sees Empty Sidebar
**Issue**: User has portal access but no page permissions
**Solution**: Grant specific page permissions or use Quick Setup

## Migration from Old System

If you have existing users who suddenly can't login:

1. **Backup your database first**
2. **Option A**: Use the admin interface
   - Go to Sidebar Permissions
   - Select each user
   - Click "Quick Setup" to restore their access
   
3. **Option B**: Run a migration script (contact developer)

## Best Practices

### User Creation
1. **Create user first** with basic info and role
2. **Immediately set permissions** - don't leave users without access
3. **Use Quick Setup** for standard role-based access
4. **Customize permissions** only when needed

### Permission Management
1. **Start with Quick Setup** then remove unwanted permissions
2. **Document custom permissions** - keep track of why specific permissions were granted
3. **Regular audits** - review user permissions periodically
4. **Test user experience** - verify permissions work as expected

### Security
1. **Never leave users without permissions** - either grant access or deactivate account
2. **Use descriptive usernames** - make it easy to identify users in permission lists
3. **Monitor failed login attempts** - users without portal access will fail to login
4. **Keep admin accounts secure** - they have full system access

This new workflow ensures maximum security while providing flexibility and ease of use through the Quick Setup feature.

## Technical Implementation

### Database Schema

#### User Model
```javascript
{
  username: String,
  password: String,
  role: String, // admin, reception, doctor, lab, pharmacy, shop
  name: String,
  email: String,
  isActive: Boolean,
  portalAccess: [String], // Array of portal IDs
  sidebarPermissions: Map // Portal ID -> Array of page IDs
}
```

#### Sidebar Config Model
```javascript
{
  portalId: String, // admin, pharmacy, etc.
  name: String,
  groups: [{
    id: String,
    title: String,
    order: Number,
    items: [{
      id: String,
      label: String,
      path: String,
      iconKey: String,
      order: Number
    }]
  }]
}
```

### Frontend Components

#### Permission Hook
```javascript
import { usePermissions } from '../hooks/usePermissions';

const permissions = usePermissions('pharmacy');

// Check portal access
permissions.hasPortalAccess('pharmacy') // true/false

// Check page access
permissions.hasPageAccess('dashboard') // true/false

// Filter menu items
const filteredItems = permissions.filterMenuItems(menuItems);
```

#### Permission Guard Component
```javascript
import PermissionGuard from '../components/PermissionGuard';

<PermissionGuard portal="pharmacy" pageId="medicines">
  <MedicinesComponent />
</PermissionGuard>
```

#### Permission Button
```javascript
import { PermissionButton } from '../components/PermissionGuard';

<PermissionButton 
  portal="pharmacy" 
  pageId="medicines"
  className="btn btn-primary"
  onClick={handleClick}
>
  Add Medicine
</PermissionButton>
```

### API Endpoints

#### User Management
- `GET /api/users` - Get all users
- `POST /api/users` - Create user (auto-assigns default permissions)
- `PUT /api/users/:username` - Update user
- `DELETE /api/users/:username` - Delete user
- `POST /api/users/login` - User login

#### Permission Management
- `PUT /api/users/:username/permissions` - Update user permissions
- `GET /api/users/:username/permissions` - Get user permissions

#### Sidebar Configuration
- `GET /api/sidebar-config` - Get all portal configurations
- `GET /api/sidebar-config/:portalId` - Get specific portal config

## Default Permissions by Role

### Admin
- **Portal Access**: All portals
- **Page Permissions**: All pages in all portals

### Pharmacy
- **Portal Access**: `['pharmacy']`
- **Page Permissions**: All pharmacy pages (dashboard, pos, medicines, suppliers, etc.)

### Reception
- **Portal Access**: `['reception']`
- **Page Permissions**: All reception pages (dashboard, pets, clients, appointments, etc.)

### Doctor
- **Portal Access**: `['doctor']`
- **Page Permissions**: All doctor pages (dashboard, medicines, prescription, etc.)

### Lab
- **Portal Access**: `['lab']`
- **Page Permissions**: All lab pages (dashboard, catalog, requests, reports, etc.)

### Shop
- **Portal Access**: `['shop']`
- **Page Permissions**: All shop pages (dashboard, products, pos, suppliers, etc.)

## Example Scenarios

### Scenario 1: Pharmacy Staff with Limited Access
**Requirement**: Pharmacy staff should only access POS and inventory, not reports or settings.

**Steps**:
1. Create user with `pharmacy` role
2. Go to Sidebar Permissions
3. Select the user
4. In Pharmacy Portal section, revoke all pages except:
   - Dashboard
   - Point of Sale
   - Inventory
5. Save changes

### Scenario 2: Multi-Portal User
**Requirement**: Manager needs access to both Admin and Pharmacy portals.

**Steps**:
1. Create user with `admin` role (or any role)
2. Go to Sidebar Permissions
3. Grant portal access to both `admin` and `pharmacy`
4. Configure page permissions for each portal as needed
5. Save changes

### Scenario 3: Read-Only User
**Requirement**: Auditor needs to view reports but not modify anything.

**Steps**:
1. Create user with appropriate role
2. Grant portal access as needed
3. Only enable read-only pages like:
   - Dashboard
   - Reports
   - History pages
4. Disable pages like Settings, Add/Edit functions

## Security Features

### Frontend Protection
- Sidebar items are filtered based on permissions
- Pages show access denied messages for unauthorized users
- Buttons can be disabled based on permissions

### Backend Protection (Optional)
- Middleware available for API route protection
- `checkPortalAccess(portal)` - Verify portal access
- `checkPageAccess(portal, pageId)` - Verify page access
- `checkRole(roles)` - Verify user role

### Example Backend Protection
```javascript
import { checkPortalAccess, checkPageAccess } from '../middleware/authMiddleware.js';

// Protect entire portal
router.use('/pharmacy/*', checkPortalAccess('pharmacy'));

// Protect specific page
router.get('/pharmacy/medicines', checkPageAccess('pharmacy', 'medicines'), (req, res) => {
  // Handler code
});
```

## Troubleshooting

### User Can't See Expected Pages
1. Check if user has portal access
2. Verify page permissions are granted
3. Ensure user role is correct
4. Check if user account is active

### Permission Changes Not Reflected
1. User needs to log out and log back in
2. Check browser localStorage for cached auth data
3. Verify API response includes updated permissions

### Sidebar Not Loading
1. Check sidebar configuration in database
2. Verify API endpoint `/api/sidebar-config` is working
3. Check browser console for JavaScript errors

## Best Practices

### User Management
1. **Use descriptive usernames** - Make them easy to identify
2. **Set appropriate roles** - Choose the most restrictive role that still allows necessary access
3. **Regular permission audits** - Review user permissions periodically
4. **Deactivate unused accounts** - Set `isActive: false` instead of deleting

### Permission Design
1. **Principle of least privilege** - Grant minimum necessary permissions
2. **Role-based defaults** - Let the system assign appropriate defaults
3. **Group similar functions** - Keep related pages together in permission groups
4. **Document custom permissions** - Keep track of why specific permissions were granted

### Security
1. **Regular password updates** - Encourage users to change passwords
2. **Monitor access logs** - Track user login and activity
3. **Backup permission data** - Include user permissions in system backups
4. **Test permission changes** - Verify permissions work as expected before deploying

## Migration Guide

If you have existing users without the new permission fields:

1. **Backup your database** first
2. Run this script to add default permissions:

```javascript
// Add to server/utils/migrate-permissions.js
import User from '../models/User.js';
import { getDefaultPermissions } from './defaultPermissions.js';

async function migrateUserPermissions() {
  const users = await User.find({
    $or: [
      { portalAccess: { $exists: false } },
      { sidebarPermissions: { $exists: false } }
    ]
  });

  for (const user of users) {
    const defaultPerms = getDefaultPermissions(user.role);
    user.portalAccess = user.portalAccess || defaultPerms.portalAccess;
    user.sidebarPermissions = user.sidebarPermissions || defaultPerms.sidebarPermissions;
    await user.save();
    console.log(`Updated permissions for user: ${user.username}`);
  }
}

migrateUserPermissions();
```

## Support

For issues or questions about the permission system:

1. Check this documentation first
2. Review the browser console for errors
3. Check server logs for API errors
4. Test with a fresh user account
5. Verify database connectivity and data integrity

The permission system is designed to be flexible and secure while remaining easy to use. With proper configuration, it provides fine-grained control over user access while maintaining a smooth user experience.