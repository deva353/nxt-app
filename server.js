import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import assessmentRoutes from "./routes/assessmentRoutes.js";
import attemptRoutes from "./routes/attemptRoutes.js";
dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
  })
);

app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Nxt Assess API is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/attempts", attemptRoutes);

const startServer = async () => {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error("MONGO_URI and JWT_SECRET must be configured");
  }

  await connectDB();

  const port = process.env.PORT || 5000;

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});