import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "womandayspin2026";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

export interface JwtPayload {
  id: string;
  name: string;
  dept: string;
  role: string;
}

function parseDob(input: string): Date | null {
  // Accept: DD/MM/YYYY, DDMMYYYY, YYYY-MM-DD
  const s = input.trim().replace(/\s/g, "");
  let d: string, m: string, y: string;

  if (s.includes("/")) {
    [d, m, y] = s.split("/");
  } else if (s.includes("-")) {
    [y, m, d] = s.split("-");
  } else if (s.length === 8) {
    d = s.slice(0, 2);
    m = s.slice(2, 4);
    y = s.slice(4, 8);
  } else {
    return null;
  }

  const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  return isNaN(date.getTime()) ? null : date;
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export async function loginWithCccdDob(
  cccd: string,
  dobInput: string
): Promise<{ token: string; employee: ReturnType<typeof sanitizeEmployee> } | null> {
  const employee = await prisma.employee.findUnique({ where: { cccd: cccd.trim() } });
  if (!employee) return null;

  const inputDob = parseDob(dobInput);
  if (!inputDob) return null;

  if (!isSameDate(new Date(employee.dob), inputDob)) return null;

  // Update last login
  await prisma.employee.update({
    where: { id: employee.id },
    data: { lastLoginAt: new Date() },
  });

  const payload: JwtPayload = {
    id: employee.id,
    name: employee.name,
    dept: employee.dept,
    role: employee.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  return { token, employee: sanitizeEmployee(employee) };
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function sanitizeEmployee(emp: {
  id: string;
  cccd: string;
  name: string;
  position: string;
  dept: string;
  role: string;
  hasSpun: boolean;
  selfieUrl: string | null;
  cardTemplateId: number | null;
  cardImageUrl: string | null;
  resultImageUrl: string | null;
}) {
  return {
    id: emp.id,
    name: emp.name,
    position: emp.position,
    dept: emp.dept,
    role: emp.role,
    hasSpun: emp.hasSpun,
    selfieUrl: emp.selfieUrl,
    cardTemplateId: emp.cardTemplateId,
    cardImageUrl: emp.cardImageUrl,
    resultImageUrl: emp.resultImageUrl,
  };
}
