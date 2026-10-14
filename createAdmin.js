
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function createAdmin() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from backend/.env");
    }

    const email = (
      process.env.ADMIN_EMAIL || "admin@nxtassess.com"
    ).toLowerCase().trim();

    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || "Nxt Assess Admin";

    if (!password || password.length < 12) {
      throw new Error(
        "Set ADMIN_PASSWORD in backend/.env to a password of at least 12 characters."
      );
    }

    await mongoose.connect(process.env.MONGO_URI);

    const hashedPassword = await bcrypt.hash(password, 10);
    let admin = await User.findOne({ email });

    if (admin) {
      admin.name = name;
      admin.password = hashedPassword;
      admin.role = "admin";
      await admin.save();

      console.log("Existing account updated as admin.");
    } else {
      await User.create({
        name,
        email,
        password: hashedPassword,
        role: "admin",
      });

      console.log("Admin account created successfully.");
    }

    console.log("Admin email:", email);
    console.log("Now log in using the password configured in backend/.env.");
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

createAdmin();
