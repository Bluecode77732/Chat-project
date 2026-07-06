import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNicknameUnique1750000000000 implements MigrationInterface {
  name = 'AddUserNicknameUnique1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD CONSTRAINT "UQ_user_entity_nickname" UNIQUE ("nickname")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP CONSTRAINT "UQ_user_entity_nickname"`,
    );
  }
}
