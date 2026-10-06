export interface Limits {
  postPerMin: number;
  approvalPerMin: number;
  createPerHour: number;
  claimPerHour: number;
  roomMaxMessages: number;
  bodyMax: number;
  pauseWindow: number;
  roomTtlDays: number;
}

export const DEFAULT_LIMITS: Limits = {
  postPerMin: 20,
  approvalPerMin: 5,
  createPerHour: 10,
  claimPerHour: 20,
  roomMaxMessages: 2000,
  bodyMax: 4000,
  pauseWindow: 6,
  roomTtlDays: 30,
};
