import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAvatarUrlToProfiles1704067200000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("profiles", new TableColumn({
            name: "avatar_url",
            type: "varchar",
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("profiles", "avatar_url");
    }

}
