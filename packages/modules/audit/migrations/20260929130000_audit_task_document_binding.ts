import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .withSchema('audit')
    .createIndex('document_tenant_project_id_unique_idx')
    .unique()
    .on('document')
    .columns(['tenant_id', 'project_id', 'id'])
    .execute()
  await database.schema
    .withSchema('audit')
    .createIndex('document_version_tenant_document_id_unique_idx')
    .unique()
    .on('document_version')
    .columns(['tenant_id', 'document_id', 'id'])
    .execute()

  await database.schema
    .withSchema('audit')
    .createTable('task')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('project_id', 'uuid', (column) => column.notNull())
    .addColumn('name', 'varchar(200)', (column) => column.notNull())
    .addColumn('objective', 'varchar(2000)', (column) => column.notNull())
    .addColumn('revision', 'integer', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid', (column) => column.notNull())
    .addForeignKeyConstraint(
      'task_project_fk',
      ['tenant_id', 'project_id'],
      'audit.project',
      ['tenant_id', 'id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addCheckConstraint('task_revision_chk', sql`revision > 0`)
    .execute()
  await database.schema
    .withSchema('audit')
    .createIndex('task_tenant_project_id_unique_idx')
    .unique()
    .on('task')
    .columns(['tenant_id', 'project_id', 'id'])
    .execute()
  await database.schema
    .withSchema('audit')
    .createIndex('task_project_created_idx')
    .on('task')
    .columns(['tenant_id', 'project_id', 'created_at'])
    .execute()

  await database.schema
    .withSchema('audit')
    .createTable('task_document_binding')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('project_id', 'uuid', (column) => column.notNull())
    .addColumn('task_id', 'uuid', (column) => column.notNull())
    .addColumn('document_id', 'uuid', (column) => column.notNull())
    .addColumn('document_version_id', 'uuid', (column) => column.notNull())
    .addColumn('role', 'varchar(100)', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid', (column) => column.notNull())
    .addColumn('removed_at', 'timestamptz')
    .addColumn('removed_by', 'uuid')
    .addForeignKeyConstraint(
      'task_binding_task_fk',
      ['tenant_id', 'project_id', 'task_id'],
      'audit.task',
      ['tenant_id', 'project_id', 'id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'task_binding_document_fk',
      ['tenant_id', 'project_id', 'document_id'],
      'audit.document',
      ['tenant_id', 'project_id', 'id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'task_binding_version_fk',
      ['tenant_id', 'document_id', 'document_version_id'],
      'audit.document_version',
      ['tenant_id', 'document_id', 'id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addCheckConstraint(
      'task_binding_removed_pair_chk',
      sql`(removed_at is null) = (removed_by is null)`,
    )
    .execute()
  await sql`create unique index task_binding_active_unique_idx on audit.task_document_binding
    (tenant_id, task_id, document_id, role) where removed_at is null`.execute(database)
  await database.schema
    .withSchema('audit')
    .createIndex('task_binding_task_created_idx')
    .on('task_document_binding')
    .columns(['tenant_id', 'task_id', 'created_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('audit').dropTable('task_document_binding').execute()
  await database.schema.withSchema('audit').dropTable('task').execute()
  await database.schema
    .withSchema('audit')
    .dropIndex('document_version_tenant_document_id_unique_idx')
    .execute()
  await database.schema
    .withSchema('audit')
    .dropIndex('document_tenant_project_id_unique_idx')
    .execute()
}
