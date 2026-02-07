import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICall extends Document {
  lead: mongoose.Types.ObjectId;
  agent: mongoose.Types.ObjectId;
  twilioCallSid?: string;
  duration: number;
  status: string;
  recording?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CallSchema = new Schema<ICall>(
  {
    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    twilioCallSid: {
      type: String,
    },
    duration: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "initiated",
        "ringing",
        "in_progress",
        "completed",
        "failed",
        "busy",
        "no_answer",
      ],
      default: "initiated",
    },
    recording: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

CallSchema.index({ lead: 1, agent: 1 });
CallSchema.index({ twilioCallSid: 1 });

const Call: Model<ICall> =
  mongoose.models.Call || mongoose.model<ICall>("Call", CallSchema);

export default Call;