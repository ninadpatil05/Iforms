import sys
sys.path.insert(0, ".")
import app.database.base
from app.database.database import SessionLocal
from app.services.user_service import user_service
from app.services.form_invite_service import form_invite_service
from app.services.submission_service import submission_service
from app.services.ai_analysis_service import ai_analysis_service
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.form_invite import FormInvite
from app.models.submission import Submission
from app.models.response_categorization import ResponseCategorization
from app.schemas.user import UserCreate
from app.schemas.ai_analysis import AiGeneratedAnalysis, AiSubmissionCategorization, AiComputedFacts
from fastapi import HTTPException
from unittest.mock import patch, AsyncMock

db = SessionLocal()
try:
    print('--- Testing Phase 0 & Phase 1 ---')
    
    # 1. Test Phase 0: assert_owns_parent_form returns submission
    user1 = User(name='User One', email='user1_test@example.com', role='user')
    user2 = User(name='User Two', email='user2_test@example.com', role='user')
    db.add_all([user1, user2])
    db.commit()
    db.refresh(user1)
    db.refresh(user2)

    form1 = Form(title='Form 1', owner_id=user1.id)
    form2 = Form(title='Form 2', owner_id=user2.id)
    db.add_all([form1, form2])
    db.commit()
    db.refresh(form1)
    db.refresh(form2)

    v1 = FormVersion(form_id=form1.id, version_number=1, is_published=True, public_link='pub1')
    v2 = FormVersion(form_id=form2.id, version_number=1, is_published=True, public_link='pub2')
    db.add_all([v1, v2])
    db.commit()
    db.refresh(v1)
    db.refresh(v2)

    sub1 = Submission(form_version_id=v1.id, status='submitted', access_token='token_valid_1')
    db.add(sub1)
    db.commit()
    db.refresh(sub1)

    # Phase 0 check
    sub_res = submission_service.assert_owns_parent_form(db, sub1.id, user1)
    assert sub_res is not None and sub_res.id == sub1.id, 'Phase 0 failed: did not return submission'
    try:
        submission_service.assert_owns_parent_form(db, sub1.id, user2)
        assert False, 'Phase 0 failed: allowed unowned user access'
    except HTTPException as e:
        assert e.status_code == 403
    print('? Phase 0: assert_owns_parent_form returns submission and blocks non-owner.')

    # 2. Test Phase 1.1: Signup role escalation prevented
    signup_in = UserCreate(name='Hacker', email='hacker@example.com', password='password123')
    created_u = user_service.create_user(db, signup_in)
    assert created_u.role == 'user', f'Phase 1.1 failed: role was {created_u.role}'
    print('? Phase 1.1: Signup role escalation prevented (hardcoded to user).')

    # 3. Test Phase 1.2: Invite-delete IDOR prevented
    inv1 = FormInvite(form_id=form1.id, email='invitee1@example.com', token='inv_token_1')
    inv2 = FormInvite(form_id=form2.id, email='invitee2@example.com', token='inv_token_2')
    db.add_all([inv1, inv2])
    db.commit()
    db.refresh(inv1)
    db.refresh(inv2)

    # Deleting form1 invite with form1 id should succeed
    del_res = form_invite_service.delete_invite(db, form_id=form1.id, invite_id=inv1.id)
    assert del_res.id == inv1.id

    # Deleting form2 invite with form1 id should 404 (IDOR blocked!)
    try:
        form_invite_service.delete_invite(db, form_id=form1.id, invite_id=inv2.id)
        assert False, 'Phase 1.2 failed: permitted cross-form invite deletion'
    except HTTPException as e:
        assert e.status_code == 404
    print('? Phase 1.2: Invite-delete IDOR prevented.')

    # 4. Test Phase 1.3: Submission access token validation in endpoints
    # Tested via route logic:
    from app.api.submissions import submit_submission, request_duplicate_override, get_duplicate_override_status
    # Wrong/missing access token should raise 403
    try:
        submit_submission(submission_id=sub1.id, access_token='wrong_token', db=db)
        assert False
    except HTTPException as e:
        assert e.status_code == 403
    try:
        submit_submission(submission_id=sub1.id, access_token=None, db=db)
        assert False
    except HTTPException as e:
        assert e.status_code == 403
    print('? Phase 1.3: Public submission endpoints require and enforce access_token.')

    # 5. Test Phase 1.4: AI analyzer categorization scoping
    # Seed a submission on form2 to simulate an alien ID
    sub2 = Submission(form_version_id=v2.id, status='submitted', access_token='token_valid_2')
    db.add(sub2)
    db.commit()
    db.refresh(sub2)

    mock_generated = AiGeneratedAnalysis(
        executive_summary='Summary',
        submission_categorizations=[
            AiSubmissionCategorization(submission_id=sub1.id, category='useful', reason='Good response'),
            AiSubmissionCategorization(submission_id=sub2.id, category='useful', reason='Alien form response'),
            AiSubmissionCategorization(submission_id=999999, category='useful', reason='Hallucinated ID'),
        ]
    )

    with patch('app.services.ai_analysis_service.analytics_service.get_dashboard') as mock_dash, \
         patch('app.services.ai_analysis_service.get_ai_provider') as mock_provider, \
         patch('app.services.ai_analysis_service.MIN_RESPONSES_FOR_ANALYSIS', 0):
        
        class OverviewMock:
            total_views = 10
            total_started = 10
            total_submitted = 10
            completion_rate = 1.0
            average_completion_seconds = 10.0
        class DashMock:
            overview = OverviewMock()
        mock_dash.return_value = DashMock()

        provider_inst = AsyncMock()
        provider_inst.analyze_responses.return_value = mock_generated.model_dump(mode='json')
        mock_provider.return_value = provider_inst

        await_res = ai_analysis_service.run_analysis(db, user1, v1.id)
        import asyncio
        report = asyncio.run(await_res) if asyncio.iscoroutine(await_res) else await_res

        # Check categorizations in DB
        cat1 = db.query(ResponseCategorization).filter(ResponseCategorization.submission_id == sub1.id).first()
        assert cat1 is not None, 'Valid submission was not categorized'
        assert cat1.category == 'useful'

        cat2 = db.query(ResponseCategorization).filter(ResponseCategorization.submission_id == sub2.id).first()
        assert cat2 is None, 'Alien submission was erroneously categorized!'

        cat_hallucinated = db.query(ResponseCategorization).filter(ResponseCategorization.submission_id == 999999).first()
        assert cat_hallucinated is None, 'Hallucinated submission was erroneously categorized!'
        print('? Phase 1.4: AI analyzer categorization safely ignores unowned/hallucinated submission IDs.')

    # Cleanup test data
    if cat1:
        db.delete(cat1)
    db.delete(created_u)
    db.delete(sub1)
    db.delete(sub2)
    db.delete(inv2)
    db.delete(v1)
    db.delete(v2)
    db.delete(form1)
    db.delete(form2)
    db.delete(user1)
    db.delete(user2)
    db.commit()
    print('All Phase 0 & Phase 1 tests passed successfully!')

finally:
    db.close()
