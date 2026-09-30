import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVideos1790806389558 implements MigrationInterface {
    name = 'CreateVideos1790806389558'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."videos_status_enum" AS ENUM('draft', 'processing', 'ready', 'failed')`);
        await queryRunner.query(`CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "public_id" character varying(16) NOT NULL, "channel_id" uuid NOT NULL, "title" character varying(150) NOT NULL, "status" "public"."videos_status_enum" NOT NULL DEFAULT 'draft', "source_key" character varying NOT NULL, "thumbnail_key" character varying, "duration_seconds" integer, "size_bytes" bigint, "metadata" jsonb, "error_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_39a1f0fe7991162aace659078ec" UNIQUE ("public_id"), CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ece1558efc6efd53eb530479db" ON "videos" ("status") `);
        await queryRunner.query(`ALTER TABLE "videos" ADD CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "videos" DROP CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ece1558efc6efd53eb530479db"`);
        await queryRunner.query(`DROP TABLE "videos"`);
        await queryRunner.query(`DROP TYPE "public"."videos_status_enum"`);
    }

}
