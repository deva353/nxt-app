import express from "express";
import mongoose from "mongoose";
import { protect, adminOnly } from "../middleware/auth.js";
import Question from "../models/Question.js";
import Assessment from "../models/Assessment.js";

const router = express.Router();

router.use(protect, adminOnly);

const validId = (id) => mongoose.isValidObjectId(id);

const validQuestionInput = (body) =>
  typeof body.text === "string" &&
  body.text.trim().length > 0 &&
  typeof body.subject === "string" &&
  body.subject.trim().length > 0 &&
  Array.isArray(body.options) &&
  body.options.length === 4 &&
  body.options.every(
    (option) => typeof option === "string" && option.trim().length > 0
  ) &&
  Number.isInteger(body.correctAnswer) &&
  body.correctAnswer >= 0 &&
  body.correctAnswer <= 3 &&
  ["Beginner", "Intermediate", "Advanced"].includes(
    body.difficulty ?? "Beginner"
  ) &&
  Number.isInteger(body.marks ?? 1) &&
  (body.marks ?? 1) >= 1 &&
  (body.marks ?? 1) <= 100;

// GET /api/admin/questions
router.get("/questions", async (req, res) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 });
    res.json(questions);
  } catch {
    res.status(500).json({ message: "Unable to load questions" });
  }
});

// POST /api/admin/questions
router.post("/questions", async (req, res) => {
  try {
    if (!validQuestionInput(req.body)) {
      return res.status(400).json({
        message: "Enter valid question text, four options and a valid answer",
      });
    }

    const question = await Question.create({
      text: req.body.text.trim(),
      options: req.body.options.map((option) => option.trim()),
      correctAnswer: req.body.correctAnswer,
      subject: req.body.subject.trim(),
      difficulty: req.body.difficulty ?? "Beginner",
      marks: req.body.marks ?? 1,
    });

    res.status(201).json({
      message: "Question created successfully",
      question,
    });
  } catch {
    res.status(500).json({ message: "Unable to create question" });
  }
});

// PUT /api/admin/questions/:id
router.put("/questions/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid question ID" });
    }

    if (!validQuestionInput(req.body)) {
      return res.status(400).json({ message: "Invalid question data" });
    }

    const question = await Question.findByIdAndUpdate(
      req.params.id,
      {
        text: req.body.text.trim(),
        options: req.body.options.map((option) => option.trim()),
        correctAnswer: req.body.correctAnswer,
        subject: req.body.subject.trim(),
        difficulty: req.body.difficulty ?? "Beginner",
        marks: req.body.marks ?? 1,
      },
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json({ message: "Question updated", question });
  } catch {
    res.status(500).json({ message: "Unable to update question" });
  }
});

// DELETE /api/admin/questions/:id
router.delete("/questions/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid question ID" });
    }

    const isUsed = await Assessment.exists({
      questions: req.params.id,
    });

    if (isUsed) {
      return res.status(409).json({
        message: "This question is used by an assessment and cannot be deleted",
      });
    }

    const question = await Question.findByIdAndDelete(req.params.id);

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json({ message: "Question deleted successfully" });
  } catch {
    res.status(500).json({ message: "Unable to delete question" });
  }
});

// GET /api/admin/assessments
router.get("/assessments", async (req, res) => {
  try {
    const assessments = await Assessment.find()
      .populate("questions", "text subject difficulty marks")
      .sort({ createdAt: -1 });

    res.json(assessments);
  } catch {
    res.status(500).json({ message: "Unable to load assessments" });
  }
});

// POST /api/admin/assessments
router.post("/assessments", async (req, res) => {
  try {
    const {
      title,
      description = "",
      subject,
      questionIds,
      durationMinutes,
      status = "draft",
    } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof subject !== "string" ||
      !subject.trim() ||
      typeof description !== "string" ||
      !Array.isArray(questionIds) ||
      questionIds.length === 0 ||
      questionIds.some((id) => !validId(id)) ||
      new Set(questionIds).size !== questionIds.length ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 300 ||
      !["draft", "published"].includes(status)
    ) {
      return res.status(400).json({
        message: "Enter a valid title, subject, question list and duration",
      });
    }

    const questions = await Question.find({
      _id: { $in: questionIds },
    });

    if (questions.length !== questionIds.length) {
      return res.status(400).json({
        message: "One or more question IDs do not exist",
      });
    }

    const totalMarks = questions.reduce(
      (sum, question) => sum + question.marks,
      0
    );

    const assessment = await Assessment.create({
      title: title.trim(),
      description: description.trim(),
      subject: subject.trim(),
      questions: questionIds,
      durationMinutes,
      totalMarks,
      status,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: "Assessment created successfully",
      assessment,
    });
  } catch {
    res.status(500).json({ message: "Unable to create assessment" });
  }
});

// PATCH /api/admin/assessments/:id/status
router.patch("/assessments/:id/status", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    const { status } = req.body;

    if (!["draft", "published"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (status === "published" && assessment.questions.length === 0) {
      return res.status(400).json({
        message: "Add at least one question before publishing",
      });
    }

    assessment.status = status;
    await assessment.save();

    res.json({
      message: `Assessment ${status}`,
      assessment,
    });
  } catch {
    res.status(500).json({ message: "Unable to update assessment status" });
  }
});

export default router;