import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";

const DATABASE_PATH = process.env.DATABASE_PATH || "app.db";

let _db: Kysely<DatabaseSchema> | null = null;

export const getDb = (): Kysely<DatabaseSchema> => {
  if (!_db) {
    const sqlite = new Database(DATABASE_PATH);
    sqlite.pragma("journal_mode = WAL");

    _db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({ database: sqlite }),
    });
  }
  return _db;
};

export interface DatabaseSchema {
  auth_state: AuthStateTable;
  auth_session: AuthSessionTable;
  account: AccountTable;
  status: StatusTable;
  place: PlaceTable;
  place_list: PlaceListTable;
}

interface AuthStateTable {
  key: string;
  value: string;
}

interface AuthSessionTable {
  key: string;
  value: string;
}

export interface AccountTable {
  did: string;
  handle: string;
  active: 0 | 1;
}

export interface StatusTable {
  uri: string;
  authorDid: string;
  status: string;
  createdAt: string;
  indexedAt: string;
  current: 0 | 1;
}

// Mirrors xyz.atmap.place. Nested objects/arrays are stored as JSON text.
export interface PlaceTable {
  uri: string;
  cid: string | null;
  authorDid: string;
  rkey: string;
  name: string;
  category: string;
  latitude: string;
  longitude: string;
  address: string | null;
  osmType: string | null;
  osmId: number | null;
  tags: string;
  lists: string;
  note: string | null;
  createdAt: string;
  indexedAt: string;
}

// Mirrors xyz.atmap.list.
export interface PlaceListTable {
  uri: string;
  cid: string | null;
  authorDid: string;
  rkey: string;
  name: string;
  description: string | null;
  createdAt: string;
  indexedAt: string;
}
