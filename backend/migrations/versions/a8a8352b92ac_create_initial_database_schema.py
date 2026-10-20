
"""create initial database schema

Revision ID: a8a8352b92ac
Revises:
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a8a8352b92ac"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # AUTH
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # KNOWLEDGE BASE
    op.create_table(
        "knowledge_base",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("chunks", sa.Integer(), server_default=sa.text("0")),
        sa.Column("size_bytes", sa.Integer()),
        sa.Column("added_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "name", name="uq_knowledge_base_user_name"),
    )

    op.create_table(
        "vector_chunks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("knowledge_base.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("page", sa.Integer()),
        sa.Column("sheet", sa.String()),
        sa.Column("rows", sa.String()),
        sa.Column("section", sa.String()),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("added_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # CLASSROOMS
    op.create_table(
        "classrooms",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "name", name="uq_classrooms_user_name"),
    )

    op.create_table(
        "classroom_documents",
        sa.Column(
            "classroom_id",
            sa.Integer(),
            sa.ForeignKey("classrooms.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("knowledge_base.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("added_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # CHATS
    op.create_table(
        "chats",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "classroom_id",
            sa.Integer(),
            sa.ForeignKey("classrooms.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(), server_default=sa.text("'New chat'")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "chat_id",
            sa.String(),
            sa.ForeignKey("chats.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # QUIZZES
    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "classroom_id",
            sa.Integer(),
            sa.ForeignKey("classrooms.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("classroom_name", sa.String(), nullable=False),
        sa.Column("num_questions", sa.Integer(), nullable=False),
        sa.Column("correct", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("difficulty", sa.String(), nullable=False),
        sa.Column(
            "include_true_false",
            sa.Boolean(),
            server_default=sa.text("false"),
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    op.create_table(
        "quiz_questions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "attempt_id",
            sa.String(),
            sa.ForeignKey("quiz_attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("answer_index", sa.Integer(), nullable=False),
        sa.Column("user_answer", sa.Integer()),
        sa.Column("explanation", sa.Text()),
        sa.Column("source_file", sa.String()),
        sa.Column("source_page", sa.Integer()),
        sa.Column("source_section", sa.String()),
    )


def downgrade() -> None:
    # Drop tables in reverse dependency order.
    op.drop_table("quiz_questions")
    op.drop_table("quiz_attempts")
    op.drop_table("chat_messages")
    op.drop_table("chats")
    op.drop_table("classroom_documents")
    op.drop_table("classrooms")
    op.drop_table("vector_chunks")
    op.drop_table("knowledge_base")
    op.drop_table("sessions")
    op.drop_table("users")
