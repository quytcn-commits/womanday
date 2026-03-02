import prisma from "../lib/prisma";

class TimerService {
  private timers = new Map<string, NodeJS.Timeout>();

  scheduleAutoLock(roomId: string, delayMs: number) {
    this.cancelAutoLock(roomId);

    const timer = setTimeout(async () => {
      this.timers.delete(roomId);
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (room?.status === "WAITING") {
        console.log(`[Timer] Auto-locking room ${roomId} (timer expired)`);
        const { lockRoom } = await import("./room.service");
        await lockRoom(roomId, "TIMER_EXPIRED");
      }
    }, delayMs);

    this.timers.set(roomId, timer);
    console.log(`[Timer] Scheduled auto-lock for room ${roomId} in ${delayMs}ms`);
  }

  cancelAutoLock(roomId: string) {
    const existing = this.timers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(roomId);
      console.log(`[Timer] Cancelled auto-lock for room ${roomId}`);
    }
  }

  // Called on server startup to recover active timers from DB
  async recoverOnStartup() {
    const waitingRooms = await prisma.room.findMany({
      where: { status: "WAITING", autoStartAt: { not: null } },
    });

    console.log(`[Timer] Recovering ${waitingRooms.length} waiting room(s) on startup`);

    for (const room of waitingRooms) {
      if (!room.autoStartAt) continue;

      const remainingMs = room.autoStartAt.getTime() - Date.now();
      if (remainingMs <= 0) {
        console.log(`[Timer] Room ${room.id} auto_start_at already passed — locking now`);
        const { lockRoom } = await import("./room.service");
        await lockRoom(room.id, "TIMER_EXPIRED");
      } else {
        this.scheduleAutoLock(room.id, remainingMs);
      }
    }

    // Recover rooms stuck in COUNTDOWN/SPINNING (server crashed mid-spin)
    const stuckRooms = await prisma.room.findMany({
      where: { status: { in: ["COUNTDOWN", "SPINNING", "LOCKED"] } },
    });

    for (const room of stuckRooms) {
      console.log(`[Timer] Room ${room.id} stuck in ${room.status} — re-executing spin`);
      const { executeSpin } = await import("./spin.service");
      await executeSpin(room.id).catch((e) =>
        console.error(`[Timer] Error re-executing spin for ${room.id}:`, e)
      );
    }
  }
}

const timerService = new TimerService();
export default timerService;
