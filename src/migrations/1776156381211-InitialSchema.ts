import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1776156381211 implements MigrationInterface {
    name = 'InitialSchema1776156381211'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "room_entity" ("created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, CONSTRAINT "PK_fc9fe8e7b09bbbeea55ba770e1a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "chat_entity" ("created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "message" character varying NOT NULL, "participantId" integer, "roomId" integer, CONSTRAINT "PK_07e65670b36d025a69930ae6f2e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_entity" ("created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "role" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_415c35b9b3b6fe45a3b065030f5" UNIQUE ("email"), CONSTRAINT "PK_b54f8ea623b17094db7667d8206" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "room_entity_participants_user_entity" ("roomEntityId" integer NOT NULL, "userEntityId" integer NOT NULL, CONSTRAINT "PK_1fb7b532ae6b330727aef49457b" PRIMARY KEY ("roomEntityId", "userEntityId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b1dab59abfc63170ed65092015" ON "room_entity_participants_user_entity" ("roomEntityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_501a0aef55632e3cf2894bda97" ON "room_entity_participants_user_entity" ("userEntityId") `);
        await queryRunner.query(`ALTER TABLE "chat_entity" ADD CONSTRAINT "FK_07b3b276973a05b736ac9e63c2e" FOREIGN KEY ("participantId") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_entity" ADD CONSTRAINT "FK_332f2ca9c6dfe6e472f26c41cb3" FOREIGN KEY ("roomId") REFERENCES "room_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "room_entity_participants_user_entity" ADD CONSTRAINT "FK_b1dab59abfc63170ed650920152" FOREIGN KEY ("roomEntityId") REFERENCES "room_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "room_entity_participants_user_entity" ADD CONSTRAINT "FK_501a0aef55632e3cf2894bda97f" FOREIGN KEY ("userEntityId") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "room_entity_participants_user_entity" DROP CONSTRAINT "FK_501a0aef55632e3cf2894bda97f"`);
        await queryRunner.query(`ALTER TABLE "room_entity_participants_user_entity" DROP CONSTRAINT "FK_b1dab59abfc63170ed650920152"`);
        await queryRunner.query(`ALTER TABLE "chat_entity" DROP CONSTRAINT "FK_332f2ca9c6dfe6e472f26c41cb3"`);
        await queryRunner.query(`ALTER TABLE "chat_entity" DROP CONSTRAINT "FK_07b3b276973a05b736ac9e63c2e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_501a0aef55632e3cf2894bda97"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b1dab59abfc63170ed65092015"`);
        await queryRunner.query(`DROP TABLE "room_entity_participants_user_entity"`);
        await queryRunner.query(`DROP TABLE "user_entity"`);
        await queryRunner.query(`DROP TABLE "chat_entity"`);
        await queryRunner.query(`DROP TABLE "room_entity"`);
    }

}
