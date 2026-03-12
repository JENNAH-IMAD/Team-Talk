using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamTalk.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SyncMissingSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        migrationBuilder.Sql("""
            ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "SecondaryRole" integer;
            ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Bio" text;
            ALTER TABLE "Messages" ADD COLUMN IF NOT EXISTS "ReactionsJson" text NOT NULL DEFAULT '[]';
            ALTER TABLE "Channels" ADD COLUMN IF NOT EXISTS "IsVoice" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE "Channels" ADD COLUMN IF NOT EXISTS "IsGroup" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE "Channels" ADD COLUMN IF NOT EXISTS "GroupName" text;

            CREATE TABLE IF NOT EXISTS "GroupParticipants" (
                "Id" uuid NOT NULL,
                "ChannelId" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "CreatedAt" timestamp without time zone NOT NULL,
                "UpdatedAt" timestamp without time zone NULL,
                CONSTRAINT "PK_GroupParticipants" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_GroupParticipants_Channels_ChannelId" FOREIGN KEY ("ChannelId") REFERENCES "Channels" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_GroupParticipants_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_GroupParticipants_ChannelId_UserId" ON "GroupParticipants" ("ChannelId", "UserId");
            CREATE INDEX IF NOT EXISTS "IX_GroupParticipants_UserId" ON "GroupParticipants" ("UserId");
        """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS "IX_GroupParticipants_ChannelId_UserId";
            DROP INDEX IF EXISTS "IX_GroupParticipants_UserId";
            DROP TABLE IF EXISTS "GroupParticipants";
            ALTER TABLE "Channels" DROP COLUMN IF EXISTS "IsVoice";
            ALTER TABLE "Channels" DROP COLUMN IF EXISTS "IsGroup";
            ALTER TABLE "Channels" DROP COLUMN IF EXISTS "GroupName";
            ALTER TABLE "Messages" DROP COLUMN IF EXISTS "ReactionsJson";
            ALTER TABLE "Users" DROP COLUMN IF EXISTS "SecondaryRole";
            ALTER TABLE "Users" DROP COLUMN IF EXISTS "Bio";
        """);
        }
    }
}
