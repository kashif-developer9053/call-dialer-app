import mongoose, { Document, Model, Schema } from "mongoose";
import { LeadStatus } from "@/types";

export interface ILead extends Document {
  name: string;
  email?: string;
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  assignedTo?: mongoose.Types.ObjectId;
  status: LeadStatus;
  score: number;
  notes: string;
  lastCallDate?: Date;
  nextFollowUp?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    zipCode: {
      type: String,
      trim: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: Object.values(LeadStatus),
      default: LeadStatus.NEW,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    notes: {
      type: String,
      default: "",
    },
    lastCallDate: {
      type: Date,
    },
    nextFollowUp: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
LeadSchema.index({ assignedTo: 1, status: 1 });
LeadSchema.index({ phone: 1 });
LeadSchema.index({ email: 1 });

const Lead: Model<ILead> =
  mongoose.models.Lead || mongoose.model<ILead>("Lead", LeadSchema);

export default Lead;