import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUserDeleteCascade1749700000000 implements MigrationInterface {
  name = 'FixUserDeleteCascade1749700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // chat_entity.participantId: NO ACTION → SET NULL
    // 유저를 삭제해도 메시지는 남도록 함 (participant가 NULL이 됨)
    await queryRunner.query(
      `ALTER TABLE "chat_entity" DROP CONSTRAINT "FK_07b3b276973a05b736ac9e63c2e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_entity" ADD CONSTRAINT "FK_07b3b276973a05b736ac9e63c2e" FOREIGN KEY ("participantId") REFERENCES "user_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // room_entity_participants_user_entity.userEntityId: NO ACTION → CASCADE
    // 유저 삭제 시 해당 유저의 room 참여 행을 자동으로 제거
    await queryRunner.query(
      `ALTER TABLE "room_entity_participants_user_entity" DROP CONSTRAINT "FK_501a0aef55632e3cf2894bda97f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_entity_participants_user_entity" ADD CONSTRAINT "FK_501a0aef55632e3cf2894bda97f" FOREIGN KEY ("userEntityId") REFERENCES "user_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // chat_entity.roomId: NO ACTION → CASCADE
    // 참여자가 0명이 된 room이 삭제되면 그 room의 chat도 자동으로 함께 삭제됨
    await queryRunner.query(
      `ALTER TABLE "chat_entity" DROP CONSTRAINT "FK_332f2ca9c6dfe6e472f26c41cb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_entity" ADD CONSTRAINT "FK_332f2ca9c6dfe6e472f26c41cb3" FOREIGN KEY ("roomId") REFERENCES "room_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_entity" DROP CONSTRAINT "FK_332f2ca9c6dfe6e472f26c41cb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_entity" ADD CONSTRAINT "FK_332f2ca9c6dfe6e472f26c41cb3" FOREIGN KEY ("roomId") REFERENCES "room_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "room_entity_participants_user_entity" DROP CONSTRAINT "FK_501a0aef55632e3cf2894bda97f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_entity_participants_user_entity" ADD CONSTRAINT "FK_501a0aef55632e3cf2894bda97f" FOREIGN KEY ("userEntityId") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "chat_entity" DROP CONSTRAINT "FK_07b3b276973a05b736ac9e63c2e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_entity" ADD CONSTRAINT "FK_07b3b276973a05b736ac9e63c2e" FOREIGN KEY ("participantId") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
