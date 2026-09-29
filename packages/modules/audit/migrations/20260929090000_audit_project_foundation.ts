import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('audit').ifNotExists().execute()
  await database.schema
    .withSchema('audit')
    .createTable('project')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('name', 'varchar(200)', (column) => column.notNull())
    .addColumn('description', 'varchar(2000)', (column) => column.notNull().defaultTo(''))
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('revision', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid', (column) => column.notNull())
    .addCheckConstraint('project_status_chk', sql`status in ('ACTIVE', 'ARCHIVED')`)
    .addCheckConstraint('project_revision_chk', sql`revision > 0`)
    .execute()
  await database.schema
    .withSchema('audit')
    .createIndex('project_tenant_status_created_idx')
    .on('project')
    .columns(['tenant_id', 'status', 'created_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('audit').dropTable('project').execute()
  await database.schema.dropSchema('audit').execute()
}
