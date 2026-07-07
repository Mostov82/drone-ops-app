// Bilingual API error contract, matching DO-004's shape: { code, message: { en, he } }.
import type { Response } from "express";

export interface BilingualMessage {
  en: string;
  he: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public messages: BilingualMessage,
  ) {
    super(messages.en);
  }
}

export function sendApiError(res: Response, err: ApiError): void {
  res.status(err.status).json({ code: err.code, message: err.messages });
}
