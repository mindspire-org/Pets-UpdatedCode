import mongoose from "mongoose";

const PetshopNotificationSchema = new mongoose.Schema(
  {
    portal: { type: String, default: "shop", index: true },
    type: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: ["high", "medium", "info", "low"],
      default: "info",
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    relatedModel: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    createdBy: { type: String, default: "System" },
  },
  { timestamps: true, collection: "petshop_notifications" },
);

export default mongoose.model("PetshopNotification", PetshopNotificationSchema);
