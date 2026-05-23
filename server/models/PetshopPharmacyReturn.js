import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PetshopPharmacyMedicine",
      required: true,
    },
    medicineName: {
      type: String,
      required: true,
    },
    batchNo: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
    },
    returnPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalReturnAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    expiryDate: {
      type: Date,
    },
    originalSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PetshopPharmacySale",
    },
    originalPurchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PetshopPharmacyPurchase",
    },
  },
  { _id: false },
);

const petshopPharmacyReturnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
    },
    returnType: {
      type: String,
      enum: ["Customer Return", "Supplier Return"],
      required: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerContact: {
      type: String,
      trim: true,
    },
    originalSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PetshopPharmacySale",
    },
    originalInvoiceNumber: {
      type: String,
      trim: true,
    },
    supplierName: {
      type: String,
      trim: true,
    },
    supplierContact: {
      type: String,
      trim: true,
    },
    originalPurchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PetshopPharmacyPurchase",
    },
    originalPurchaseOrderNo: {
      type: String,
      trim: true,
    },
    items: [returnItemSchema],
    totalReturnAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    returnDate: {
      type: Date,
      default: Date.now,
    },
    refundMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Credit Note", "Store Credit"],
      default: "Cash",
    },
    refundStatus: {
      type: String,
      enum: ["Pending", "Processed", "Rejected"],
      default: "Pending",
    },
    processedBy: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    approvedBy: {
      type: String,
      trim: true,
    },
    approvalDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'petshop_returns'
  },
);

petshopPharmacyReturnSchema.index({ returnNumber: 1 });
petshopPharmacyReturnSchema.index({ returnType: 1 });
petshopPharmacyReturnSchema.index({ returnDate: -1 });
petshopPharmacyReturnSchema.index({ originalSaleId: 1 });
petshopPharmacyReturnSchema.index({ originalPurchaseId: 1 });
petshopPharmacyReturnSchema.index({ supplierName: 1 });
petshopPharmacyReturnSchema.index({ customerContact: 1 });

const PetshopPharmacyReturn = mongoose.model("PetshopPharmacyReturn", petshopPharmacyReturnSchema);

export default PetshopPharmacyReturn;
