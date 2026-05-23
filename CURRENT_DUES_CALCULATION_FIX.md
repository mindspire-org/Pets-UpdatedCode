# Current Dues Calculation Fix

## Problem Analysis

The Current Dues calculation in the main client directory table had **multiple double-counting issues**:

1. **Inconsistent calculation logic** with the Pet-wise Financial Breakdown
2. **Double-counting of consultation fees** (Fixed in v1)
3. **Double-counting between pet registration consultation fees and PharmacyDue stored dues** (Fixed in v2)

### Previous Flawed Logic
The old implementation in `loadClientFinancials()` function:
1. Only looked at the **most recent transaction** to determine current dues
2. Used a complex timestamp comparison to pick between latest sale, procedure, or appointment
3. Applied different calculation logic depending on which was most recent
4. **Double-counted consultation fees** by including both Financial records AND pet registration fees
5. **Double-counted consultation dues** by adding both pet registration consultation fees AND stored dues from PharmacyDue table
6. This resulted in **inaccurate and inflated** dues calculations

### Pet-wise Financial Breakdown Logic (Correct)
The Pet-wise Financial Breakdown (via `financialSummaryAPI`) correctly:
1. **Aggregates ALL pending amounts** across all modules
2. **Avoids double-counting** by tracking which pets already have consultation fees in Financial records
3. Only includes pet registration consultation fees for pets NOT already recorded in Financial records
4. **Separates stored dues** from PharmacyDue table as a separate field, not added to module totals
5. Uses `totalPending` (sum of module pending amounts) for "Total Dues" calculation
6. Keeps `currentDue` (from PharmacyDue table) as separate metadata

## Solution Implemented

### Fix v1: Avoid Financial Records Double-Counting
```javascript
// Track which pets already have consultation fees recorded in Financial records
const consultPaidByPet = new Set()
consultFinancials.forEach(f => {
  if (f.petId) consultPaidByPet.add(String(f.petId).trim())
})

const consultantPending = pets.reduce((sum, pet) => {
  const petId = String(pet.id || pet._id || '').trim()
  // Only count pet registration fees if this pet doesn't have a Financial record for consultation
  if (!consultPaidByPet.has(petId)) {
    const fee = toNum(pet.details?.clinic?.consultantFees)
    const received = toNum(pet.details?.clinic?.receivedAmount)
    return sum + Math.max(0, fee - received)
  }
  return sum
}, 0)
```

### Fix v2: Avoid PharmacyDue Double-Counting
```javascript
// 5. Previous dues from PharmacyDue table (opening balances)
// NOTE: This should NOT include consultation fees as they're handled separately in consultantPending
const storedDue = toNum(dueRow?.previousDue)

// Total current dues = sum of all module pending amounts
// Do NOT add storedDue here as it may contain consultation fees that are already counted in consultantPending
const totalCurrentDues = pharmacyPending + proceduresPending + appointmentsPending + consultantPending

duesMap[cid] = totalCurrentDues
```

### Root Cause of v2 Issue
The consultation fees were being counted **twice**:
1. **From pet registration** - calculated as (consultantFees - receivedAmount)
2. **From PharmacyDue table** - stored as previousDue which may already include consultation fees

The server-side logic correctly separates these:
- `totalPending` = sum of module pending amounts (including consultation from pet registrations)
- `currentDue` = stored due from PharmacyDue table (separate field, not added to totalPending)

## Key Benefits

1. **Consistency**: Current Dues in main table now matches Pet-wise Financial Breakdown exactly
2. **Accuracy**: All pending amounts are properly aggregated without double-counting
3. **No Double-Counting**: Consultation fees are only counted once from the correct source
4. **Proper Separation**: PharmacyDue stored dues are not mixed with module-specific pending amounts
5. **Comprehensive**: Includes all modules (pharmacy, procedures, appointments, consultant fees)
6. **Maintainability**: Matches server-side logic exactly

## Files Modified

- `src/pages/reception/Clients.jsx` - Updated `loadClientFinancials()` function and imports

## Testing Recommendation

1. Open reception portal → Clients Directory
2. Check client "wertyu" (ID: CL-177763154920634567891):
   - Consultation fee: Rs. 2,000
   - Received: Rs. 500
   - Should show Current Due: Rs. 1,500 (not Rs. 2,000)
3. Click "View" on any client with consultation dues
4. Compare the "Current Due" in the unified summary with the Pet-wise Financial Breakdown table
5. Verify the "Total Dues" column in Pet-wise Financial Breakdown matches the main table's Current Due

The calculations should now be **identical** across both views, and consultation fees should only be counted once without any double-counting from PharmacyDue stored dues.