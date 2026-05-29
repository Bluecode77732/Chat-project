import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiColumns1748433600000 implements MigrationInterface {
  name = 'AddAiColumns1748433600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "isAI" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_entity" ADD "aiPersonality" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_entity" ADD "aiPersonalityChangedOnce" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_entity" DROP COLUMN "aiPersonalityChangedOnce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_entity" DROP COLUMN "aiPersonality"`,
    );
    await queryRunner.query(`ALTER TABLE "user_entity" DROP COLUMN "isAI"`);
  }
}
