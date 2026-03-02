import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Event Config ──────────────────────────────────────────
  await prisma.eventConfig.upsert({
    where: { key: "event_status" },
    update: {},
    create: { key: "event_status", value: "PENDING" },
  });

  await prisma.eventConfig.upsert({
    where: { key: "event_round" },
    update: {},
    create: { key: "event_round", value: "1" },
  });

  const defaultPrizeConfig = JSON.stringify([
    { tier: "FIRST", label: "Giải Nhất — 2.500.000đ", value: 2500000, count: 1, color: "#D4AF37" },
    { tier: "SECOND", label: "Giải Nhì — 1.000.000đ", value: 1000000, count: 10, color: "#C9B8A8" },
    { tier: "THIRD", label: "Giải Ba — 500.000đ", value: 500000, count: 20, color: "#B87D6B" },
    { tier: "CONS", label: "Giải KK — 210.000đ", value: 210000, count: 369, color: "#D4708F" },
  ]);
  await prisma.eventConfig.upsert({
    where: { key: "prize_config" },
    update: {},
    create: { key: "prize_config", value: defaultPrizeConfig },
  });

  // ── Prize Pool (400 prizes) ────────────────────────────────
  const existingPrizes = await prisma.prize.count();
  if (existingPrizes === 0) {
    console.log("  Creating 400 prizes...");
    const prizes: { tier: string; value: number }[] = [];

    prizes.push({ tier: "FIRST", value: 2500000 });
    for (let i = 0; i < 10; i++) prizes.push({ tier: "SECOND", value: 1000000 });
    for (let i = 0; i < 20; i++) prizes.push({ tier: "THIRD", value: 500000 });
    for (let i = 0; i < 369; i++) prizes.push({ tier: "CONS", value: 210000 });

    // Shuffle để random hơn khi assign
    prizes.sort(() => Math.random() - 0.5);

    await prisma.prize.createMany({ data: prizes });
    console.log(`  ✅ Created ${prizes.length} prizes`);
  } else {
    console.log(`  ⏭  Prize pool already exists (${existingPrizes} prizes)`);
  }

  // ── Demo Admin ──────────────────────────────────────────────
  const admin = await prisma.employee.upsert({
    where: { cccd: "000000000000" },
    update: {},
    create: {
      cccd: "000000000000",
      dob: new Date("1990-01-01"),
      name: "Admin Hệ Thống",
      position: "Admin",
      dept: "IT",
      role: "admin",
    },
  });
  console.log(`  ✅ Admin: CCCD=000000000000, DOB=01/01/1990`);

  // ── Demo Employees (10 nhân viên test) ──────────────────────
  const demoEmployees = [
    { cccd: "001090001234", dob: "1992-03-08", name: "Nguyễn Thị Lan", position: "Kế Toán Trưởng", dept: "Kế Toán" },
    { cccd: "001090002234", dob: "1995-05-15", name: "Trần Thị Hoa", position: "Nhân Viên", dept: "HR" },
    { cccd: "001090003234", dob: "1993-11-20", name: "Lê Thị Mai", position: "Chuyên Viên", dept: "Marketing" },
    { cccd: "001090004234", dob: "1990-07-12", name: "Phạm Thị Thu", position: "Trưởng Phòng", dept: "IT" },
    { cccd: "001090005234", dob: "1997-02-28", name: "Hoàng Thị Hà", position: "Nhân Viên", dept: "Kinh Doanh" },
    { cccd: "001090006234", dob: "1994-09-03", name: "Vũ Thị Linh", position: "Chuyên Viên", dept: "IT" },
    { cccd: "001090007234", dob: "1996-01-18", name: "Đặng Thị Nga", position: "Nhân Viên", dept: "Kế Toán" },
    { cccd: "001090008234", dob: "1991-06-25", name: "Bùi Thị Trang", position: "Chuyên Viên", dept: "HR" },
    { cccd: "001090009234", dob: "1998-12-10", name: "Ngô Thị Yến", position: "Nhân Viên", dept: "Marketing" },
    { cccd: "001090010234", dob: "1993-04-14", name: "Đinh Thị Kim", position: "Trưởng Nhóm", dept: "Kinh Doanh" },
  ];

  for (const emp of demoEmployees) {
    await prisma.employee.upsert({
      where: { cccd: emp.cccd },
      update: {},
      create: {
        cccd: emp.cccd,
        dob: new Date(emp.dob),
        name: emp.name,
        position: emp.position,
        dept: emp.dept,
        role: "user",
      },
    });
  }
  console.log(`  ✅ Created ${demoEmployees.length} demo employees`);
  console.log("\n📋 Demo Login Info:");
  console.log("  Admin:  CCCD=000000000000, DOB=01/01/1990");
  console.log("  User 1: CCCD=001090001234, DOB=08/03/1992 (Nguyễn Thị Lan)");
  console.log("  User 2: CCCD=001090002234, DOB=15/05/1995 (Trần Thị Hoa)");
  console.log("  (xem seed.ts để biết tất cả tài khoản demo)");
  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
