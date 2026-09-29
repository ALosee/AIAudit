import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE FUNCTION audit.reject_document_version_change() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'audit.document_version is immutable';
    END
    $$
  `.execute(database)
  await sql`
    CREATE TRIGGER document_version_immutable
    BEFORE UPDATE OR DELETE ON audit.document_version
    FOR EACH ROW EXECUTE FUNCTION audit.reject_document_version_change()
  `.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER document_version_immutable ON audit.document_version`.execute(database)
  await sql`DROP FUNCTION audit.reject_document_version_change()`.execute(database)
}
