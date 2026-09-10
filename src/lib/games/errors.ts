import { NextResponse } from "next/server";

/**
 * Ports the Postgres errcode carried by every `raise exception ... using
 * errcode = '...'` in the old RPCs. Consuming components (JoinGameForm.jsx,
 * GameQuestion.jsx) switch on `err.code` — see src/services/games.ts's fetch
 * wrapper, which rehydrates this from the JSON error body.
 */
export class GameError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status ?? GameError.statusFor(code);
  }

  static statusFor(code: string): number {
    switch (code) {
      case "P0002":
        return 404; // not found
      case "P0003": // draft, not launched
      case "P0004": // that's a class code
        return 409;
      case "P0005": // join locked
        return 403;
      case "28000": // invalid state / not a participant / not open
        return 403;
      case "22023": // invalid input
        return 400;
      case "23503": // FK / doesn't belong
        return 400;
      case "23505": // unique violation
        return 409;
      case "42501": // not authorized
        return 403;
      default:
        return 400;
    }
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof GameError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("games route error:", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
