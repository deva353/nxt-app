import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [
        {
          type: String,
          required: true,
          trim: true,
        },
      ],
      validate: {
        validator: (options) =>
          options.length === 4 &&
          options.every((option) => option.length > 0),
        message: "A question must have exactly 4 non-empty options",
      },
    },
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    marks: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Question", questionSchema);