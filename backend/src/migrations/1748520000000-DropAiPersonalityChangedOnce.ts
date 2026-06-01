import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAiPersonalityChangedOnce1748520000000
  implements MigrationInterface
{
  name = 'DropAiPersonalityChangedOnce1748520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_entity" DROP COLUMN IF EXISTS "aiPersonalityChangedOnce"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_entity" ADD "aiPersonalityChangedOnce" boolean NOT NULL DEFAULT false`,
    );
  }
}
