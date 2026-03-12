using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamTalk.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixRolesJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        migrationBuilder.Sql("""
            ALTER TABLE "Users"
            ADD COLUMN IF NOT EXISTS "RolesJson" text;
        """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        migrationBuilder.Sql("""
            ALTER TABLE "Users"
            DROP COLUMN IF EXISTS "RolesJson";
        """);
        }
    }
}
