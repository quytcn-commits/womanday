import { parse } from "csv-parse";
import { Readable } from "stream";
import prisma from "./prisma";

interface CsvRow {
  cccd: string;
  dob: string; // DD/MM/YYYY
  name: string;
  position: string;
  dept: string;
}

function parseDate(str: string): Date {
  // Accept DD/MM/YYYY or YYYY-MM-DD
  const trimmed = str.trim();
  if (trimmed.includes("/")) {
    const [d, m, y] = trimmed.split("/");
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }
  return new Date(trimmed);
}

export async function importEmployeesFromCsv(
  buffer: Buffer
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    const errors: string[] = [];

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    parser.on("readable", () => {
      let record;
      while ((record = parser.read()) !== null) {
        rows.push(record);
      }
    });

    parser.on("error", (err) => reject(err));

    parser.on("end", async () => {
      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const cccd = row.cccd?.trim();
        const dobStr = row.dob?.trim();
        const name = row.name?.trim();
        const position = row.position?.trim() || "Nhân Viên";
        const dept = row.dept?.trim() || "Chưa Phân Loại";

        if (!cccd || !dobStr || !name) {
          errors.push(`Dòng thiếu dữ liệu: ${JSON.stringify(row)}`);
          skipped++;
          continue;
        }

        try {
          const dob = parseDate(dobStr);
          if (isNaN(dob.getTime())) {
            errors.push(`Ngày sinh không hợp lệ cho ${name}: ${dobStr}`);
            skipped++;
            continue;
          }

          await prisma.employee.upsert({
            where: { cccd },
            update: { name, position, dept, dob },
            create: { cccd, dob, name, position, dept, role: "user" },
          });
          imported++;
        } catch (e) {
          errors.push(`Lỗi import ${name} (${cccd}): ${(e as Error).message}`);
          skipped++;
        }
      }

      resolve({ imported, skipped, errors });
    });

    Readable.from(buffer).pipe(parser);
  });
}
