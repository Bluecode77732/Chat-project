import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLog1749800000000 implements MigrationInterface {
  name = 'CreateAuditLog1749800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_log_entity" (
        "id"       SERIAL NOT NULL,
        "actorId"  integer NOT NULL,
        "targetId" integer,
        "action"   character varying NOT NULL,
        "detail"   character varying,
        "created"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log_entity" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_log_entity"`);
  }
}
