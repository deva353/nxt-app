import express from "express";
import { protect } from "../middleware/auth.js";
import Assessment from "../models/Assessment.js";

const router = express.Router();

// GET /api/assessments
router.get("/", protect, async (req, res) => {
  try {
    const assessments = await Assessment.find({
      status: "published",
    })
      .select("title description subject durationMinutes totalMarks questions")
      .sort({ createdAt: -1 })
      .lean();

    const result = assessments.map((assessment) => ({
      id: assessment._id,
      title: assessment.title,
      description: assessment.description,
      subject: assessment.subject,
      durationMinutes: assessment.durationMinutes,
      totalMarks: assessment.totalMarks,
      questionCount: assessment.questions.length,
    }));

    res.json(result);
  } catch {
    res.status(500).json({ message: "Unable to load assessments" });
  }
});

export default router;