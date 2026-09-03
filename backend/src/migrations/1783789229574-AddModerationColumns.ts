import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModerationColumns1783789229574 implements MigrationInterface {
  name = 'AddModerationColumns1783789229574';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 컬럼만 변경. "room_entity_participants_user_entity"에 대해 자동 생성된
    // FK drop/re-add는 제거함: FixUserDeleteCascade1749700000000이 설정한 ON DELETE
    // CASCADE를 되돌려버리는데, UserService.remove가 이 CASCADE에 의존하고 있음.
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
