import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtractAiPersonalityToAiRoomEntity1749639600000 implements MigrationInterface {
  name = 'ExtractAiPersonalityToAiRoomEntity1749639600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_room_entity" (
        "created" TIMESTAMP NOT NULL DEFAULT now(),
        "updated" TIMESTAMP NOT NULL DEFAULT now(),
        "id" SERIAL NOT NULL,
        "personality" character varying NOT NULL,
        "room_id" integer,
        CONSTRAINT "REL_ai_room_entity_room" UNIQUE ("room_id"),
        CONSTRAINT "PK_ai_room_entity" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_room_entity"
        ADD CONSTRAINT "FK_ai_room_entity_room"
        FOREIGN KEY ("room_id") REFERENCES "room_entity"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_entity" DROP COLUMN "aiPersonality"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_entity" ADD "aiPersonality" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_room_entity" DROP CONSTRAINT "FK_ai_room_entity_room"`,
    );
    await queryRunner.query(`DROP TABLE "ai_room_entity"`);
  }
}
