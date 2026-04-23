import mongoose from 'mongoose';

const purchaseOrderItemSchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'PharmacyMedicine', required: true },
  medicineName: { type: String, required: true },
  category: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'packs' }
});

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  expectedDelivery: { type: Date },
  companyName: { type: String },
  deliveryAddress: { type: String },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: { type: String, required: true },
  supplierPhone: { type: String },
  items: [purchaseOrderItemSchema],
  notes: { type: String },
  terms: { type: String },
  authorizedBy: { type: String },
  status: { 
    type: String, 
    enum: ['Pending', 'Sent', 'Received', 'Cancelled'], 
    default: 'Pending' 
  },
  portal: { type: String, default: 'pharmacy' }
}, {
  timestamps: true
});

purchaseOrderSchema.index({ poNumber: 1 });
purchaseOrderSchema.index({ supplierName: 1 });
purchaseOrderSchema.index({ date: -1 });

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export default PurchaseOrder;
