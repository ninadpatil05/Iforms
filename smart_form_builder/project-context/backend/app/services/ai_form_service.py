from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.ai_form_draft import AiFormDraft
from app.models.form import Form
from app.models.user import User
from app.repositories.ai_form_draft_repository import ai_form_draft_repository
from app.schemas.ai_form import (
    AiFieldTypeForGeneration,
    AiFormGenerationResult,
)
from app.schemas.field import CHOICE_TYPES, VALIDATION_KEYS, FieldCreate, FieldOption, FieldType
from app.schemas.form import FormCreate
from app.schemas.section import SectionCreate
from app.services.ai.factory import get_ai_provider
from app.services.field_service import field_service
from app.services.form_service import form_service
from app.services.section_service import section_service


def _build_ai_prompt(user_prompt: str) -> str:
    allowed_types = [t.value for t in AiFieldTypeForGeneration]
    valid_keys_desc: dict[str, list[str]] = {}
    for t in AiFieldTypeForGeneration:
        ft = FieldType(t.value)
        keys = list(VALIDATION_KEYS.get(ft, set()))
        valid_keys_desc[t.value] = sorted(keys)

    instructions = (
        f"Generate a complete form structure based on the following prompt:\n"
        f"\"{user_prompt}\"\n\n"
        f"Constraints & Rules:\n"
        f"1. You MUST use only the following allowed field_type values: {allowed_types}.\n"
        f"2. For choice types ('dropdown', 'checkbox'), you MUST provide at least one option with 'label' and 'value'.\n"
        f"3. For non-choice types, 'options' must be null.\n"
        f"4. Allowed validation_config keys per field_type:\n"
    )
    for ft_name, keys in valid_keys_desc.items():
        instructions += f"   - {ft_name}: {keys}\n"

    instructions += (
        "\nOrganize fields logically into sections and include brief ai_rationale explaining why each field was included."
    )
    return instructions


class AiFormService:
    async def generate_draft(self, db: Session, user: User, prompt: str) -> AiFormDraft:
        ai_prompt = _build_ai_prompt(prompt)
        provider = get_ai_provider()
        
        raw_dict = await provider.generate_form(prompt=ai_prompt, response_schema=AiFormGenerationResult)
        
        try:
            validated_result = AiFormGenerationResult.model_validate(raw_dict)
        except ValidationError as val_err:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI response couldn't be understood, please try again.",
            ) from val_err

        obj_in: dict[str, Any] = {
            "user_id": user.id,
            "prompt": prompt,
            "generated_json": validated_result.model_dump(mode="json"),
            "status": "pending",
        }
        return ai_form_draft_repository.create(db, obj_in)

    async def regenerate_draft(
        self, db: Session, user: User, draft_id: int, new_prompt: Optional[str]
    ) -> AiFormDraft:
        draft = ai_form_draft_repository.get_by_id_for_user(db, draft_id=draft_id, user_id=user.id)
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI form draft not found.",
            )

        prompt_to_use = new_prompt.strip() if (new_prompt and new_prompt.strip()) else draft.prompt
        ai_prompt = _build_ai_prompt(prompt_to_use)
        provider = get_ai_provider()

        raw_dict = await provider.generate_form(prompt=ai_prompt, response_schema=AiFormGenerationResult)

        try:
            validated_result = AiFormGenerationResult.model_validate(raw_dict)
        except ValidationError as val_err:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI response couldn't be understood, please try again.",
            ) from val_err

        update_data: dict[str, Any] = {
            "prompt": prompt_to_use,
            "generated_json": validated_result.model_dump(mode="json"),
            "status": "pending",
        }
        return ai_form_draft_repository.update(db, db_obj=draft, obj_in=update_data)

    def discard_draft(self, db: Session, user: User, draft_id: int) -> None:
        draft = ai_form_draft_repository.get_by_id_for_user(db, draft_id=draft_id, user_id=user.id)
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI form draft not found.",
            )
        ai_form_draft_repository.delete(db, draft_id)

    def accept_draft(
        self, db: Session, user: User, draft_id: int, edited_draft: AiFormGenerationResult
    ) -> Form:
        draft = ai_form_draft_repository.get_by_id_for_user(db, draft_id=draft_id, user_id=user.id)
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI form draft not found.",
            )

        # 1. Create real Form
        form_in = FormCreate(
            title=edited_draft.title,
            description=edited_draft.description,
            owner_id=user.id,
        )
        form = form_service.create_form(db, form_in)

        # 2. Get or create draft version
        draft_version = form_service.get_or_create_draft_version(db, form.id)

        # 3. Create sections and fields
        for sec in edited_draft.sections:
            sec_in = SectionCreate(
                form_version_id=draft_version.id,
                title=sec.title,
                description=sec.description,
                display_order=sec.display_order,
            )
            created_section = section_service.create_section(db, sec_in)

            for fld in sec.fields:
                field_options = (
                    [FieldOption(label=opt.label, value=opt.value) for opt in fld.options]
                    if fld.options
                    else None
                )
                field_in = FieldCreate(
                    form_version_id=draft_version.id,
                    section_id=created_section.id,
                    label=fld.label,
                    field_type=FieldType(fld.field_type.value),
                    placeholder=fld.placeholder,
                    required=fld.required,
                    options=field_options,
                    validation_config=fld.validation_config,
                    display_order=fld.display_order,
                )
                field_service.create_field(db, field_in)

        # 4. Mark draft as accepted
        ai_form_draft_repository.update(
            db,
            db_obj=draft,
            obj_in={
                "status": "accepted",
                "form_id": form.id,
                "accepted_at": datetime.now(timezone.utc),
            },
        )

        return form


ai_form_service = AiFormService()
