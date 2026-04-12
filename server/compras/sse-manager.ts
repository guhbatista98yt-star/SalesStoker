import type { Response } from "express";

interface SseClient {
  userId: number;
  res: Response;
}

const clients = new Map<string, SseClient>();

export function addSseClient(clientId: string, userId: number, res: Response): void {
  clients.set(clientId, { userId, res });
}

export function removeSseClient(clientId: string): void {
  clients.delete(clientId);
}

export function broadcastToUser(userId: number, event: string, data: unknown): void {
  for (const [, client] of clients) {
    if (client.userId === userId) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
      }
    }
  }
}

export function broadcastToAll(event: string, data: unknown): void {
  for (const [, client] of clients) {
    try {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
