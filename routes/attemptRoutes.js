import express from "express";
import mongoose from "mongoose";
import { protect } from "../middleware/auth.js";
import Assessment from "../models/Assessment.js";
import Question from "../models/Question.js";
import Attempt from "../models/Attempt.js";

const router = express.Router();

router.use(protect);

const validId = (id) => mongoose.isValidObjectId(id);

const calculateScore = async (attempt) => {
  const questions = await Question.find({
    _id: { $in: attempt.questions },
  }).select("_id correctAnswer marks");

  const questionMap = new Map(
    questions.map((question) => [
      question._id.toString(),
      question,
    ])
  );

  let score = 0;

  for (const answer of attempt.answers) {
    const question = questionMap.get(
      answer.questionId.toString()
    );

    if (
      question &&
      answer.selectedOption === question.correctAnswer
    ) {
      score += question.marks;
    }
  }

  return score;
};

const finishAttempt = async (attempt, expired = false) => {
  attempt.score = await calculateScore(attempt);
  attempt.status = expired ? "expired" : "submitted";
  attempt.submittedAt = new Date();

  await attempt.save();

  return attempt;
};

// POST /api/attempts/start/:assessmentId
router.post("/start/:assessmentId", async (req, res) => {
  try {
    const { assessmentId } = req.params;

    if (!validId(assessmentId)) {
      return res.status(400).json({
        message: "Invalid assessment ID",
      });
    }

    const assessment = await Assessment.findOne({
      _id: assessmentId,
      status: "published",
    });

    if (!assessment) {
      return res.status(404).json({
        message: "Published assessment not found",
      });
    }

    // Resume an existing unfinished attempt instead of
    // giving the student a fresh timer.
    let attempt = await Attempt.findOne({
      userId: req.user._id,
      assessmentId: assessment._id,
      status: "in-progress",
    });

   if (attempt && Date.now() >= attempt.expiresAt.getTime()) {
  attempt = await finishAttempt(attempt, true);

  return res.json({
    message: "Assessment time has expired",
    attemptId: attempt._id,
    status: attempt.status,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
  });
}

    if (attempt && attempt.status === "in-progress") {
      return res.json({
        message: "Resuming assessment",
        attemptId: attempt._id,
        expiresAt: attempt.expiresAt,
        status: attempt.status,
      });
    }

    if (attempt) {
      return res.status(409).json({
        message: "This assessment attempt has ended",
        attemptId: attempt._id,
        status: attempt.status,
      });
    }

    const questions = await Question.find({
      _id: { $in: assessment.questions },
    }).select("_id");

    if (
      questions.length !== assessment.questions.length ||
      questions.length === 0
    ) {
      return res.status(400).json({
        message: "Assessment has missing or no questions",
      });
    }

    const startedAt = new Date();
    const expiresAt = new Date(
      startedAt.getTime() +
        assessment.durationMinutes * 60 * 1000
    );

    attempt = await Attempt.create({
      userId: req.user._id,
      assessmentId: assessment._id,
      questions: assessment.questions,
      answers: [],
      startedAt,
      expiresAt,
      totalMarks: assessment.totalMarks,
      status: "in-progress",
    });

    res.status(201).json({
      message: "Assessment started",
      attemptId: attempt._id,
      expiresAt: attempt.expiresAt,
      status: attempt.status,
    });
  } catch (error) {
    console.error("Start attempt error:", error.message);
    res.status(500).json({
      message: "Unable to start assessment",
    });
  }
});

// GET /api/attempts/:attemptId
router.get("/:attemptId", async (req, res) => {
  try {
    const { attemptId } = req.params;

    if (!validId(attemptId)) {
      return res.status(400).json({
        message: "Invalid attempt ID",
      });
    }

    const attempt = await Attempt.findOne({
      _id: attemptId,
      userId: req.user._id,
    }).populate("questions", "text options subject difficulty marks");

    if (!attempt) {
      return res.status(404).json({
        message: "Attempt not found",
      });
    }

    if (
      attempt.status === "in-progress" &&
      Date.now() >= attempt.expiresAt.getTime()
    ) {
      await finishAttempt(attempt, true);

      return res.json({
        status: "expired",
        submittedAt: attempt.submittedAt,
        score: attempt.score,
        totalMarks: attempt.totalMarks,
      });
    }

    res.json({
      attemptId: attempt._id,
      assessmentId: attempt.assessmentId,
      questions: attempt.questions,
      answers: attempt.answers,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      status: attempt.status,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      submittedAt: attempt.submittedAt,
    });
  } catch (error) {
    console.error("Get attempt error:", error.message);
    res.status(500).json({
      message: "Unable to load attempt",
    });
  }
});

// PUT /api/attempts/:attemptId/answers
router.put("/:attemptId/answers", async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selectedOption } = req.body;

    if (!validId(attemptId) || !validId(questionId)) {
      return res.status(400).json({
        message: "Invalid attempt or question ID",
      });
    }

    if (
      !Number.isInteger(selectedOption) ||
      selectedOption < 0 ||
      selectedOption > 3
    ) {
      return res.status(400).json({
        message: "Select a valid option",
      });
    }

    const attempt = await Attempt.findOne({
      _id: attemptId,
      userId: req.user._id,
    });

    if (!attempt) {
      return res.status(404).json({
        message: "Attempt not found",
      });
    }

    if (attempt.status !== "in-progress") {
      return res.status(409).json({
        message: "This attempt is no longer active",
      });
    }

    if (Date.now() >= attempt.expiresAt.getTime()) {
      await finishAttempt(attempt, true);

      return res.status(409).json({
        message: "Time expired. Your answers have been submitted.",
      });
    }

    if (
      !attempt.questions.some(
        (id) => id.toString() === questionId
      )
    ) {
      return res.status(400).json({
        message: "Question does not belong to this assessment",
      });
    }

    const question = await Question.findById(questionId).select("_id");

    if (!question) {
      return res.status(400).json({
        message: "Question no longer exists",
      });
    }

    const existingAnswer = attempt.answers.find(
      (answer) => answer.questionId.toString() === questionId
    );

    if (existingAnswer) {
      existingAnswer.selectedOption = selectedOption;
    } else {
      attempt.answers.push({
        questionId,
        selectedOption,
      });
    }

    await attempt.save();

    res.json({
      message: "Answer saved",
      questionId,
      selectedOption,
    });
  } catch (error) {
    console.error("Save answer error:", error.message);
    res.status(500).json({
      message: "Unable to save answer",
    });
  }
});

// POST /api/attempts/:attemptId/submit
router.post("/:attemptId/submit", async (req, res) => {
  try {
    const { attemptId } = req.params;

    if (!validId(attemptId)) {
      return res.status(400).json({
        message: "Invalid attempt ID",
      });
    }

    const attempt = await Attempt.findOne({
      _id: attemptId,
      userId: req.user._id,
    });

    if (!attempt) {
      return res.status(404).json({
        message: "Attempt not found",
      });
    }

    if (attempt.status !== "in-progress") {
      return res.json({
        message: "Attempt has already ended",
        attemptId: attempt._id,
        status: attempt.status,
        score: attempt.score,
        totalMarks: attempt.totalMarks,
      });
    }

    const expired = Date.now() >= attempt.expiresAt.getTime();

    await finishAttempt(attempt, expired);

    res.json({
      message: expired
        ? "Time expired. Assessment submitted."
        : "Assessment submitted successfully",
      attemptId: attempt._id,
      status: attempt.status,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      submittedAt: attempt.submittedAt,
    });
  } catch (error) {
    console.error("Submit attempt error:", error.message);
    res.status(500).json({
      message: "Unable to submit assessment",
    });
  }
});

export default router;