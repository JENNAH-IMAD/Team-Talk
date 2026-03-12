using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamTalk.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSecondaryRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SecondaryRole",
                table: "Users",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SecondaryRole",
                table: "Users");
        }
    }
}
