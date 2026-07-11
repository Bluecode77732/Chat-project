import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModerationColumns1783789229574 implements MigrationInterface {
  name = 'AddModerationColumns1783789229574';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Column-only. The auto-generated FK drop/re-add for
    // "room_entity_participants_user_entity" was removed: it reverted the ON DELETE
    // CASCADE set by FixUserDeleteCascade1749700000000, which UserService.remove relies on.
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "status" character varying(16) NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "bannedUntil" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP COLUMN "bannedUntil"`,
    );
    await queryRunner.query(`ALTER TABLE "user_entity" DROP COLUMN "status"`);
  }
}
