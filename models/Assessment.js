import mongoose from "mongoose";

const assessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 300,
    },
    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Assessment", assessmentSchema);