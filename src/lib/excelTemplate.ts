import * as XLSX from "xlsx";

export function generateLeadTemplate() {
  // Template data with instructions
  const templateData = [
    {
      name: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
      company: "ABC Corp",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      assignedToEmail: "john@calldialer.com",
    },
    {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "+1987654321",
      company: "XYZ Inc",
      address: "456 Oak Ave",
      city: "Los Angeles",
      state: "CA",
      zipCode: "90001",
      assignedToEmail: "sarah@calldialer.com",
    },
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(templateData);

  // Set column widths
  ws["!cols"] = [
    { wch: 20 }, // name
    { wch: 25 }, // email
    { wch: 15 }, // phone
    { wch: 20 }, // company
    { wch: 30 }, // address
    { wch: 15 }, // city
    { wch: 10 }, // state
    { wch: 10 }, // zipCode
    { wch: 25 }, // assignedToEmail
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Leads");

  // Create instructions sheet
  const instructions = [
    { Field: "name", Required: "Yes", Description: "Full name of the lead" },
    { Field: "email", Required: "No", Description: "Email address" },
    { Field: "phone", Required: "Yes", Description: "Phone number with country code" },
    { Field: "company", Required: "No", Description: "Company name" },
    { Field: "address", Required: "No", Description: "Street address" },
    { Field: "city", Required: "No", Description: "City" },
    { Field: "state", Required: "No", Description: "State/Province" },
    { Field: "zipCode", Required: "No", Description: "ZIP/Postal code" },
    {
      Field: "assignedToEmail",
      Required: "Yes",
      Description: "Email of the agent to assign this lead to (must exist in system)",
    },
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  // Generate buffer
  const wbout = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return wbout;
}