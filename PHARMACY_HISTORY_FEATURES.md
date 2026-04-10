# Pharmacy Module - Sales & Purchase History with Returns

## Overview
Comprehensive pharmacy management system with detailed sales history, purchase history, customer returns, and supplier returns functionality. All operations properly reflect inventory stock levels.

## New Features Implemented

### 1. Sales History (`/pharmacy/sales-history`)
- **Comprehensive filtering**: Date range, customer name, contact, invoice number, payment method, status
- **Detailed view**: Complete sale information with line items, payment details, and related returns
- **Summary statistics**: Total sales, revenue, discounts, average sale amount
- **Pagination**: Efficient handling of large datasets
- **Export functionality**: CSV export for reporting
- **Real-time data**: Integrated with existing sales system

### 2. Purchase History (`/pharmacy/purchase-history`)
- **Advanced filtering**: Date range, supplier name, invoice number, purchase order number, payment status
- **Detailed tracking**: Purchase information with items, payment status, and supplier details
- **Financial overview**: Total purchases, amounts paid, outstanding balances
- **Supplier integration**: Links to supplier records and payment history
- **Return tracking**: Shows related supplier returns

### 3. Customer Returns (`/pharmacy/customer-returns`)
- **Return processing**: Create returns from original sales with automatic stock adjustment
- **Flexible reasons**: Defective, expired, wrong item, customer request, etc.
- **Refund methods**: Cash, bank transfer, credit note, store credit
- **Approval workflow**: Pending → Processed/Rejected status management
- **Inventory impact**: Automatically adds returned items back to stock
- **Audit trail**: Complete tracking of return process

### 4. Supplier Returns (`/pharmacy/supplier-returns`)
- **Return creation**: Select medicines from inventory to return to suppliers
- **Stock validation**: Ensures sufficient stock before processing returns
- **Return reasons**: Defective, expired, damaged, wrong item, excess stock
- **Inventory adjustment**: Automatically removes returned items from stock
- **Supplier tracking**: Links returns to supplier records
- **Approval system**: Status management for return processing

## Database Schema

### PharmacyReturn Model
```javascript
{
  returnNumber: String (unique),
  returnType: 'Customer Return' | 'Supplier Return',
  customerName: String,
  customerContact: String,
  supplierName: String,
  supplierContact: String,
  originalSaleId: ObjectId,
  originalPurchaseId: ObjectId,
  items: [{
    medicineId: ObjectId,
    medicineName: String,
    batchNo: String,
    quantity: Number,
    returnPrice: Number,
    reason: String,
    // ... other item details
  }],
  totalReturnAmount: Number,
  refundMethod: String,
  refundStatus: 'Pending' | 'Processed' | 'Rejected',
  processedBy: String,
  approvedBy: String,
  notes: String
}
```

## API Endpoints

### Sales History
- `GET /api/pharmacy-history/sales-history` - Get filtered sales history
- `GET /api/pharmacy-history/sales-history/:id` - Get detailed sale information

### Purchase History
- `GET /api/pharmacy-history/purchase-history` - Get filtered purchase history
- `GET /api/pharmacy-history/purchase-history/:id` - Get detailed purchase information

### Returns Management
- `GET /api/pharmacy-history/returns` - Get all returns with filters
- `POST /api/pharmacy-history/returns/customer` - Create customer return
- `POST /api/pharmacy-history/returns/supplier` - Create supplier return
- `PUT /api/pharmacy-history/returns/:id/status` - Update return status

## Key Features

### Inventory Integration
- **Real-time stock updates**: All sales, purchases, and returns automatically update inventory
- **Stock validation**: Prevents overselling and invalid returns
- **Batch tracking**: Maintains batch number integrity across all operations
- **Expiry management**: Tracks expiry dates for returns and stock management

### Financial Tracking
- **Complete audit trail**: Every transaction is recorded with full details
- **Payment tracking**: Multiple payment methods and status management
- **Outstanding balances**: Real-time calculation of supplier payables
- **Return impact**: Financial adjustments for returns and refunds

### User Experience
- **Intuitive interface**: Clean, modern UI with easy navigation
- **Advanced filtering**: Multiple filter options for efficient data retrieval
- **Export capabilities**: CSV export for external reporting
- **Mobile responsive**: Works on all device sizes
- **Real-time updates**: Immediate reflection of changes across the system

### Security & Validation
- **Data validation**: Comprehensive input validation on both frontend and backend
- **User tracking**: Records who processed each transaction
- **Approval workflows**: Multi-level approval for returns
- **Error handling**: Graceful error handling with user-friendly messages

## Navigation
New menu items added to Pharmacy Layout:
- Sales History
- Purchase History  
- Customer Returns
- Supplier Returns

## Usage Examples

### Creating a Customer Return
1. Navigate to Customer Returns
2. Click "New Return"
3. Search for original sale by invoice number or customer details
4. Select items to return with quantities and reasons
5. Choose refund method
6. Process return (automatically updates inventory)

### Viewing Sales History
1. Navigate to Sales History
2. Use filters to narrow down results (date range, customer, payment method)
3. Click "View" on any sale for detailed information
4. Export data as CSV for reporting

### Processing Supplier Returns
1. Navigate to Supplier Returns
2. Click "New Return"
3. Search and add medicines to return
4. Specify quantities, prices, and reasons
5. Submit for approval
6. Admin can approve/reject returns

## Benefits
- **Complete traceability**: Full audit trail of all pharmacy operations
- **Accurate inventory**: Real-time stock levels with automatic adjustments
- **Financial control**: Detailed tracking of all monetary transactions
- **Compliance ready**: Comprehensive records for regulatory requirements
- **Operational efficiency**: Streamlined processes for returns and history tracking
- **Data-driven decisions**: Rich reporting capabilities for business insights