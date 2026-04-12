import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "./pg-client";
import { users } from "@shared/models/auth";

export const db = drizzle(pool, { schema: { users } });

export { pool };
