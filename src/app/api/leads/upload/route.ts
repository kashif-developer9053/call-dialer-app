import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Lead from "@/models/Lead";
import User from "@/models/User";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Read file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse Excel
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return NextResponse.json(
        { error: "Excel file is empty" },
        { status: 400 }
      );
    }

    await dbConnect();

    const results = {
      total: data.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];

      try {
        // Validate required fields
        if (!row.name || !row.phone || !row.assignedToEmail) {
          results.failed++;
          results.errors.push(
            `Row ${i + 2}: Missing required fields (name, phone, or assignedToEmail)`
          );
          continue;
        }

        // Find assigned user by email
        const assignedUser = await User.findOne({
          email: row.assignedToEmail.toLowerCase().trim(),
        });

        if (!assignedUser) {
          results.failed++;
          results.errors.push(
            `Row ${i + 2}: User with email '${row.assignedToEmail}' not found`
          );
          continue;
        }

        // Check if lead already exists (by phone)
        const existingLead = await Lead.findOne({
          phone: row.phone.toString().trim(),
        });

        if (existingLead) {
          results.failed++;
          results.errors.push(
            `Row ${i + 2}: Lead with phone '${row.phone}' already exists`
          );
          continue;
        }

        // Create lead
        await Lead.create({
          name: row.name.toString().trim(),
          email: row.email ? row.email.toString().trim() : undefined,
          phone: row.phone.toString().trim(),
          company: row.company ? row.company.toString().trim() : undefined,
          address: row.address ? row.address.toString().trim() : undefined,
          city: row.city ? row.city.toString().trim() : undefined,
          state: row.state ? row.state.toString().trim() : undefined,
          zipCode: row.zipCode ? row.zipCode.toString().trim() : undefined,
          assignedTo: assignedUser._id,
          status: "new",
          score: 0,
          notes: "",
        });

        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    return NextResponse.json(
      {
        message: "Upload completed",
        results,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}