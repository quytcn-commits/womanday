// ============================================================
// Shared Types — WomanDay Spin
// ============================================================

export type Role = "user" | "admin";

export type RoomStatus =
  | "CREATED"
  | "WAITING"
  | "LOCKED"
  | "COUNTDOWN"
  | "SPINNING"
  | "REVEAL"
  | "DONE";

export type ParticipantState =
  | "JOINED"
  | "SPINNING"
  | "REVEALED"
  | "DONE";

export type PrizeTier = string;

export interface Employee {
  id: string;
  cccd: string;
  name: string;
  position: string;
  dept: string;
  role: Role;
  hasSpun: boolean;
  selfieUrl: string | null;
  cardTemplateId: number | null;
  cardImageUrl: string | null;
  resultImageUrl: string | null;
}

export interface RoomParticipant {
  slotIndex: number;
  userId: string | null;
  name: string | null;
  dept: string | null;
  position: string | null;
  selfieUrl: string | null;
  cardImageUrl: string | null;
  state: ParticipantState | "EMPTY";
}

export interface Room {
  id: string;
  name: string | null;
  status: RoomStatus;
  capacity: number;
  participantCount: number;
  participants: RoomParticipant[];
  waitingStartedAt: string | null;
  autoStartAt: string | null;
  lockedAt: string | null;
  countdownStartedAt: string | null;
  spinStartedAt: string | null;
  doneAt: string | null;
}

export interface PrizeResult {
  tier: PrizeTier;
  value: number;
  label: string;
}

export interface SpinResult {
  slotIndex: number;
  userId: string;
  name: string;
  dept: string;
  selfieUrl: string | null;
  tier: PrizeTier;
  value: number;
  resultImageUrl: string | null;
}

export interface ChatMessage {
  id: string;
  roomId: string | null;
  userId: string;
  name: string;
  dept: string;
  message: string;
  type: "user" | "system" | "admin";
  reactions: Record<string, number>;
  createdAt: string;
}

export interface PrizeTierStat {
  total: number;
  assigned: number;
  remaining: number;
  label?: string;
  color?: string;
}

export type PrizePoolStats = Record<string, PrizeTierStat>;

export interface PrizeTierConfig {
  tier: string;
  label: string;
  value: number;
  count: number;
  color: string;
}

// ── WebSocket Event Payloads ──────────────────────────────────

export interface WS_RoomCreated {
  event: "room_created";
  roomId: string;
  qrUrl: string;
  createdAt: string;
}

export interface WS_ParticipantJoined {
  event: "participant_joined";
  roomId: string;
  slotIndex: number;
  participant: {
    userId: string;
    name: string;
    dept: string;
    selfieUrl: string | null;
    cardImageUrl: string | null;
  };
  participantCount: number;
}

export interface WS_RoomLocked {
  event: "room_locked";
  roomId: string;
  reason: "ADMIN_TRIGGERED" | "TIMER_EXPIRED" | "ROOM_FULL";
  participantCount: number;
}

export interface WS_CountdownStarted {
  event: "countdown_started";
  roomId: string;
  remainingSeconds: number;
  spinAt: string;
}

export interface WS_CountdownTick {
  event: "countdown_tick";
  roomId: string;
  remainingSeconds: number;
}

export interface WS_SpinStarted {
  event: "spin_started";
  roomId: string;
  participantCount: number;
  startedAt: string;
}

export interface WS_RevealResult {
  event: "reveal_result";
  roomId: string;
  slotIndex: number;
  sequence: number;
  totalSlots: number;
  user: {
    userId: string;
    name: string;
    dept: string;
    selfieUrl: string | null;
  };
  prize: {
    tier: PrizeTier;
    value: number;
    label: string;
  };
  isHighTier: boolean;
}

export interface WS_RoomResultsReady {
  event: "room_results_ready";
  roomId: string;
  results: SpinResult[];
  summary: Record<string, number>;
}

export interface WS_ChatMessage {
  event: "chat_message";
  id: string;
  roomId: string | null;
  user: {
    userId: string;
    name: string;
    dept: string;
  };
  message: string;
  type: "user" | "system";
  reactions: Record<string, number>;
  createdAt: string;
}

export interface WS_ReactionUpdated {
  event: "reaction_updated";
  messageId: string;
  reactions: Record<string, number>;
}

export interface WS_ModerationAction {
  event: "moderation_action";
  action: "DELETE_MESSAGE" | "MUTE_USER";
  messageId?: string;
  userId?: string;
}

export interface WS_ImageReady {
  event: "image_ready";
  userId: string;
  type: "card" | "result";
  imageUrl: string;
}

export interface WS_SystemMessage {
  event: "system_message";
  roomId: string | null;
  message: string;
  type: "info" | "error" | "success";
}

export const PRIZE_LABELS: Record<PrizeTier, string> = {
  FIRST: "Giải Nhất — 2.500.000đ",
  SECOND: "Giải Nhì — 1.000.000đ",
  THIRD: "Giải Ba — 500.000đ",
  CONS: "Giải Khuyến Khích — 210.000đ",
};

export const PRIZE_VALUES: Record<PrizeTier, number> = {
  FIRST: 2500000,
  SECOND: 1000000,
  THIRD: 500000,
  CONS: 210000,
};
