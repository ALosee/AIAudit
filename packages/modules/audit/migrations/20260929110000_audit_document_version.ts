import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .withSchema('audit')
    .createIndex('project_tenant_id_unique_idx')
    .unique()
    .on('project')
    .columns(['tenant_id', 'id'])
    .execute()

  await database.schema
    .withSchema('audit')
    .createTable('document')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('project_id', 'uuid', (column) => column.notNull())
    .addColumn('name', 'varchar(200)', (column) => column.notNull())
    .addColumn('latest_version_number', 'integer', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid', (column) => column.notNull())
    .addForeignKeyConstraint(
      'document_project_fk',
      ['tenant_id', 'project_id'],
      'audit.project',
      ['tenant_id', 'id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addCheckConstraint('document_latest_version_chk', sql`latest_version_number > 0`)
    .execute()
  await database.schema
    .withSchema('audit')
    .createIndex('document_tenant_id_unique_idx')
    .unique()
    .on('document')
    .columns(['tenant_id', 'id'])
    .execute()
  await database.schema
    .withSchema('audit')
    .createIndex('document_project_created_idx')
    .on('document')
    .columns(['tenant_id', 'project_id', 'created_at'])
    .execute()

  await database.schema
    .withSchema('audit')
    .createTable('document_version')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('document_id', 'uuid', (column) => column.notNull())
    .addColumn('version_number', 'integer', (column) => column.notNull())
    .addColumn('file_name', 'varchar(255)', (column) => column.notNull())
    .addColumn('content_type', 'varchar(100)', (column) => column.notNull())
    .addColumn('byte_size', 'integer', (column) => column.notNull())
    .addColumn('sha256', 'char(64)', (column) => column.notNull())
    .addColumn('object_key', 'varchar(512)', (column) => column.notNull().unique())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid', (column) => column.notNull())
    .addForeignKeyConstraint(
      'document_version_document_fk',
      ['tenant_id', 'document_id'],
      'audit.document',
      ['tenant_id', 'id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addUniqueConstraint('document_version_number_unique', ['document_id', 'version_number'])
    .addCheckConstraint('document_version_number_chk', sql`version_number > 0`)
    .addCheckConstraint('document_version_size_chk', sql`byte_size > 0 and byte_size <= 20971520`)
    .addCheckConstraint(
      'document_version_type_chk',
      sql`content_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
    )
    .execute()
  await database.schema
    .withSchema('audit')
    .createIndex('document_version_created_idx')
    .on('document_version')
    .columns(['tenant_id', 'document_id', 'version_number'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('audit').dropTable('document_version').execute()
  await database.schema.withSchema('audit').dropTable('document').execute()
  await database.schema.withSchema('audit').dropIndex('project_tenant_id_unique_idx').execute()
}
