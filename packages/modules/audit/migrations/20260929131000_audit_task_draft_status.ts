import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .withSchema('audit')
    .alterTable('task')
    .addColumn('status', 'varchar(20)', (column) => column.notNull().defaultTo('DRAFT'))
    .execute()
  await database.schema
    .withSchema('audit')
    .alterTable('task')
    .addCheckConstraint('task_status_chk', sql`status in ('DRAFT')`)
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('audit').alterTable('task').dropColumn('status').execute()
}
