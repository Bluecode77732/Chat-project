import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfileImage1782476259595 implements MigrationInterface {
  name = 'AddUserProfileImage1782476259595';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "profileImage" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP COLUMN "profileImage"`,
    );
  }
}
