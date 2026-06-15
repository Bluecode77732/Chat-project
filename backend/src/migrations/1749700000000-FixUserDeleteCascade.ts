import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUserDeleteCascade1749700000000 implements MigrationInterface {
  name = 'FixUserDeleteCascade1749700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // chat_entity.participantId: NO ACTION → SET NULL
    // Allows deleting a user while keeping their messages (participant becomes NULL)
    await queryRunner.query(
      `ALTER TABLE "chat_entity" DROP CONSTRAINT "FK_07b3b276973a05b736ac9e63c2e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_entity" ADD CONSTRAINT "FK_07b3b276973a05b736ac9e63c2e" FOREIGN KEY ("participantId") REFERENCES "user_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // room_entity_participants_user_entity.userEntityId: NO ACTION → CASCADE
    // Removes the user's room membership rows automatically on user delete
    await queryRunner.query(
      `ALTER TABLE "room_entity_participants_user_entity" DROP CONSTRAINT "FK_501a0aef55632e3cf2894bda97f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_entity_participants_user_entity" ADD CONSTRAINT "FK_501a0aef55632e3cf2894bda97f" FOREIGN KEY ("userEntityId") REFERENCES "user_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // chat_entity.roomId: NO ACTION → CASCADE
    // When an orphaned room (0 participants) is deleted, its chats are deleted automatically
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
