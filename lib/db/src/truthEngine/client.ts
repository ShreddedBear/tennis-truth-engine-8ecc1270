import type { SQL } from "drizzle-orm";
import { db } from "../index";

export type TruthTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type TruthClient = typeof db | TruthTransaction;
export type QueryFragment = SQL;

export { db as truthDb };

export async function inTruthTransaction<T>(client: TruthClient, callback: (tx: TruthClient) => Promise<T>) {
  if ("transaction" in client) return client.transaction((tx) => callback(tx));
  return callback(client);
}