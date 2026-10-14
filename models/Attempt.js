import mongoose from "mongoose";

const attemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: true,
        },
        selectedOption: {
          type: Number,
          min: 0,
          max: 3,
        },
      },
    ],
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["in-progress", "submitted", "expired"],
      default: "in-progress",
    },
    score: {
      type: Number,
      default: null,
    },
    totalMarks: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Attempt", attemptSchema);