// Default permissions for each role
export const getDefaultPermissions = (role) => {
  const rolePermissions = {
    admin: {
      portalAccess: ['admin', 'reception', 'doctor', 'lab', 'pharmacy', 'shop'],
      sidebarPermissions: {
        admin: ['dashboard', 'pets', 'clients', 'inventory', 'hospital-inventory', 'financials', 'finance-center', 'accounting-overview', 'chart-of-accounts', 'vouchers', 'petty-cash', 'suppliers', 'receivables', 'payables', 'vendor-payments', 'budget-planner', 'staff-advances', 'day-sessions', 'expenses', 'doctors', 'staff', 'users', 'sidebar-permissions', 'logs', 'settings'],
        reception: ['dashboard', 'pets', 'clients', 'appointments', 'visits', 'billing', 'reports', 'forms', 'procedures', 'settings'],
        doctor: ['dashboard', 'medicines', 'prescription', 'medical-forms', 'medical-forms-history', 'details', 'patients', 'settings'],
        lab: ['dashboard', 'catalog', 'requests', 'add-report', 'reports', 'inventory', 'sample-intake', 'radiology', 'suppliers', 'settings'],
        pharmacy: ['dashboard', 'pos', 'credit-customers', 'medicines', 'suppliers', 'companies', 'purchase-orders', 'sales-history', 'purchase-history', 'return-history', 'sales-return', 'supplier-returns', 'referrals', 'prescriptions', 'reports', 'notifications', 'audit-logs', 'expenses', 'settings'],
        shop: ['dashboard', 'products', 'pos', 'suppliers', 'companies', 'reports', 'settings']
      }
    },
    reception: {
      portalAccess: ['reception'],
      sidebarPermissions: {
        reception: ['dashboard', 'pets', 'clients', 'appointments', 'visits', 'billing', 'reports', 'forms', 'procedures', 'settings']
      }
    },
    doctor: {
      portalAccess: ['doctor'],
      sidebarPermissions: {
        doctor: ['dashboard', 'medicines', 'prescription', 'medical-forms', 'medical-forms-history', 'details', 'patients', 'settings']
      }
    },
    lab: {
      portalAccess: ['lab'],
      sidebarPermissions: {
        lab: ['dashboard', 'catalog', 'requests', 'add-report', 'reports', 'inventory', 'sample-intake', 'radiology', 'suppliers', 'settings']
      }
    },
    pharmacy: {
      portalAccess: ['pharmacy'],
      sidebarPermissions: {
        pharmacy: ['dashboard', 'pos', 'credit-customers', 'medicines', 'suppliers', 'companies', 'purchase-orders', 'sales-history', 'purchase-history', 'return-history', 'sales-return', 'supplier-returns', 'referrals', 'prescriptions', 'reports', 'notifications', 'audit-logs', 'expenses', 'settings']
      }
    },
    shop: {
      portalAccess: ['shop'],
      sidebarPermissions: {
        shop: ['dashboard', 'products', 'pos', 'suppliers', 'companies', 'reports', 'settings']
      }
    }
  };

  const normalizedRole = role.toLowerCase();
  return rolePermissions[normalizedRole] || {
    portalAccess: [],
    sidebarPermissions: {}
  };
};

export default getDefaultPermissions;