import React from "react";
import PharmacyAuditLogs from "../../pharmacy/AuditLogs";

// AuditLogs uses activityLogsAPI which is shared across portals.
// We reuse the same component — it shows all activity logs.
export default function ShopPharmacyAuditLogs() {
  return <PharmacyAuditLogs />;
}
