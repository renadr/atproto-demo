import { Kysely } from "kysely";
import { Migration, Migrator } from "kysely/migration";
import { getDb } from ".";

const migrations: Record<string, Migration> = {
  "001": {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable("auth_state")
        .addColumn("key", "text", (col) => col.primaryKey())
        .addColumn("value", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("auth_session")
        .addColumn("key", "text", (col) => col.primaryKey())
        .addColumn("value", "text", (col) => col.notNull())
        .execute();
    },
    async down(db: Kysely<unknown>) {
      await db.schema.dropTable("auth_session").execute();
      await db.schema.dropTable("auth_state").execute();
    },
  },
  "002": {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable("account")
        .addColumn("did", "text", (col) => col.primaryKey())
        .addColumn("handle", "text", (col) => col.notNull())
        .addColumn("active", "integer", (col) => col.notNull().defaultTo(1))
        .execute();

      await db.schema
        .createTable("status")
        .addColumn("uri", "text", (col) => col.primaryKey())
        .addColumn("authorDid", "text", (col) => col.notNull())
        .addColumn("status", "text", (col) => col.notNull())
        .addColumn("createdAt", "text", (col) => col.notNull())
        .addColumn("indexedAt", "text", (col) => col.notNull())
        .addColumn("current", "integer", (col) => col.notNull().defaultTo(0))
        .execute();

      await db.schema
        .createIndex("status_current_idx")
        .on("status")
        .columns(["current", "indexedAt"])
        .execute();
    },
    async down(db: Kysely<unknown>) {
      await db.schema.dropIndex("status_current_idx").on("status").execute();
      await db.schema.dropTable("status").execute();
      await db.schema.dropTable("account").execute();
    },
  },
  "003": {
    // Index of xyz.atmap.* records. Each row mirrors one record from a user's
    // repo (keyed by its AT-URI); the PDS stays the source of truth.
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable("place")
        .addColumn("uri", "text", (col) => col.primaryKey())
        .addColumn("cid", "text")
        .addColumn("authorDid", "text", (col) => col.notNull())
        .addColumn("rkey", "text", (col) => col.notNull())
        .addColumn("name", "text", (col) => col.notNull())
        .addColumn("category", "text", (col) => col.notNull())
        .addColumn("latitude", "text", (col) => col.notNull())
        .addColumn("longitude", "text", (col) => col.notNull())
        .addColumn("address", "text")
        .addColumn("osmType", "text")
        .addColumn("osmId", "integer")
        .addColumn("tags", "text", (col) => col.notNull().defaultTo("[]"))
        .addColumn("lists", "text", (col) => col.notNull().defaultTo("[]"))
        .addColumn("note", "text")
        .addColumn("createdAt", "text", (col) => col.notNull())
        .addColumn("indexedAt", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createIndex("place_author_idx")
        .on("place")
        .columns(["authorDid", "createdAt"])
        .execute();

      await db.schema
        .createTable("place_list")
        .addColumn("uri", "text", (col) => col.primaryKey())
        .addColumn("cid", "text")
        .addColumn("authorDid", "text", (col) => col.notNull())
        .addColumn("rkey", "text", (col) => col.notNull())
        .addColumn("name", "text", (col) => col.notNull())
        .addColumn("description", "text")
        .addColumn("createdAt", "text", (col) => col.notNull())
        .addColumn("indexedAt", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createIndex("place_list_author_idx")
        .on("place_list")
        .columns(["authorDid", "createdAt"])
        .execute();
    },
    async down(db: Kysely<unknown>) {
      await db.schema.dropIndex("place_list_author_idx").execute();
      await db.schema.dropTable("place_list").execute();
      await db.schema.dropIndex("place_author_idx").execute();
      await db.schema.dropTable("place").execute();
    },
  },
};

export function getMigrator() {
  const db = getDb();
  return new Migrator({
    db,
    provider: {
      getMigrations: async () => migrations,
    },
  });
}
