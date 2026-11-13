import sys
sys.path.insert(0, ".")
import io
import asyncio
from fastapi import HTTPException
from app.main import app, lifespan
from app.services.export_service import export_service
from app.schemas.submission import FormSubmissionResponse
from app.utils.rate_limit import check_rate_limit, _GLOBAL_RATE_LIMIT_STORE

print('--- Testing Phase 2 & Phase 3 ---')

# 1. Test Phase 2: Lifespan auto-migrations
async def test_lifespan():
    async with lifespan(app):
        pass
    print('? Phase 2: Lifespan runs auto-migrations cleanly.')

asyncio.run(test_lifespan())

from datetime import datetime, timezone

# 2. Test Phase 3.1: Formula Injection Sanitization in CSV and XLSX
sub_data = [
    FormSubmissionResponse(
        id=1,
        form_version_id=10,
        respondent_identifier='=cmd|/C calc!A0',
        status='submitted',
        started_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
        version_number=1,
        answers=[
            {
                'id': 101,
                'submission_id': 1,
                'field_id': 1,
                'value_text': '+1+2',
                'file_url': None,
                'field_label': 'Formula Field 1',
                'field_type': 'text',
                'display_order': 1,
                'file_download_url': None
            },
            {
                'id': 102,
                'submission_id': 1,
                'field_id': 2,
                'value_text': '-@SUM(1,2)',
                'file_url': None,
                'field_label': 'Formula Field 2',
                'field_type': 'text',
                'display_order': 2,
                'file_download_url': None
            },
            {
                'id': 103,
                'submission_id': 1,
                'field_id': 3,
                'value_text': '@SUM(1,2)',
                'file_url': None,
                'field_label': 'Formula Field 3',
                'field_type': 'text',
                'display_order': 3,
                'file_download_url': None
            },
            {
                'id': 104,
                'submission_id': 1,
                'field_id': 4,
                'value_text': 'Normal text',
                'file_url': None,
                'field_label': 'Normal Field',
                'field_type': 'text',
                'display_order': 4,
                'file_download_url': None
            }
        ]
    )
]

csv_bytes = export_service.generate_csv(sub_data)
csv_str = csv_bytes.decode('utf-8-sig')
assert "'=cmd|/C calc!A0" in csv_str, 'CSV formula injection: respondent_identifier not sanitized!'
assert "'+1+2" in csv_str, 'CSV formula injection: + not sanitized!'
assert "'-@SUM(1,2)" in csv_str, 'CSV formula injection: - not sanitized!'
assert "'@SUM(1,2)" in csv_str, 'CSV formula injection: @ not sanitized!'
assert 'Normal text' in csv_str and "'Normal text" not in csv_str, 'CSV formula injection: normal text altered!'

xlsx_bytes = export_service.generate_xlsx(sub_data)
import openpyxl
wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
ws = wb.active
row2 = [cell.value for cell in ws[2]]
assert row2[0] == "'=cmd|/C calc!A0", f'XLSX formula injection: respondent_identifier not sanitized! Got {row2[0]}'
assert row2[4] == "'+1+2"
assert row2[5] == "'-@SUM(1,2)"
assert row2[6] == "'@SUM(1,2)"
assert row2[7] == 'Normal text'
print('? Phase 3.1: CSV & XLSX formula injection protection verified.')

# 3. Test Phase 3.2 & 3.3: Rate Limiting & Stale Key Eviction
test_store = {}
key = 'test_rate_key'
for i in range(5):
    check_rate_limit(store=test_store, key=key, max_requests=5, window_seconds=60)

try:
    check_rate_limit(store=test_store, key=key, max_requests=5, window_seconds=60)
    assert False, 'Rate limit was not enforced!'
except HTTPException as e:
    assert e.status_code == 429

# Test eviction of expired keys
import time
test_store['expired_key'] = [time.time() - 100]
check_rate_limit(store=test_store, key='expired_key', max_requests=5, window_seconds=60)
# Should have evicted the expired timestamp and added the new one
assert len(test_store['expired_key']) == 1

print('? Phase 3.2 & 3.3: Consolidated rate limiting and key eviction verified.')
print('All Phase 2 & Phase 3 tests passed successfully!')
