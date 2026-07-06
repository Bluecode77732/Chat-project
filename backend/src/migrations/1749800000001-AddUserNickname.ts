import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNickname1749800000001 implements MigrationInterface {
  name = 'AddUserNickname1749800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "nickname" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_entity" DROP COLUMN "nickname"`);
  }
}
