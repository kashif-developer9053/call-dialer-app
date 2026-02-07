import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User";
import { UserRole } from "../types";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined in environment variables");
  process.exit(1);
}

async function seed() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing users
    await User.deleteMany({});
    console.log("🗑️  Cleared existing users");

    // Create Admin user
    const adminPassword = await bcrypt.hash("admin123", 10);
    await User.create({
      name: "Admin User",
      email: "admin@calldialer.com",
      password: adminPassword,
      role: UserRole.ADMIN,
      isActive: true,
    });
    console.log("✅ Admin created: admin@calldialer.com / admin123");

    // Create Manager user
    const managerPassword = await bcrypt.hash("manager123", 10);
    await User.create({
      name: "Manager User",
      email: "manager@calldialer.com",
      password: managerPassword,
      role: UserRole.MANAGER,
      isActive: true,
    });
    console.log("✅ Manager created: manager@calldialer.com / manager123");

    // Create 3 Agent users
    const agentPassword = await bcrypt.hash("agent123", 10);
    
    await User.create({
      name: "John Agent",
      email: "john@calldialer.com",
      password: agentPassword,
      role: UserRole.AGENT,
      isActive: true,
    });

    await User.create({
      name: "Sarah Agent",
      email: "sarah@calldialer.com",
      password: agentPassword,
      role: UserRole.AGENT,
      isActive: true,
    });

    await User.create({
      name: "Mike Agent",
      email: "mike@calldialer.com",
      password: agentPassword,
      role: UserRole.AGENT,
      isActive: true,
    });

    console.log("✅ 3 Agents created (password: agent123)");
    console.log("\n📋 LOGIN CREDENTIALS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Admin:   admin@calldialer.com   / admin123");
    console.log("Manager: manager@calldialer.com / manager123");
    console.log("Agent 1: john@calldialer.com    / agent123");
    console.log("Agent 2: sarah@calldialer.com   / agent123");
    console.log("Agent 3: mike@calldialer.com    / agent123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    await mongoose.disconnect();
    console.log("✅ Seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();