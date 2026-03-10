from __future__ import annotations

import json
import os
import re
import urllib.request
from pathlib import Path
from typing import Any, Dict, List


def build_messages(input_data: Dict[str, Any], context: Dict[str, Any]) -> List[Dict[str, str]]:
    user_payload = {
        "task": "Analyze the given A-share market snapshots and output only valid JSON strictly matching the provided schema.",
        "input_data": input_data,
        "schema": context["schema"],
        "supporting_rules": {
            "scoring_excerpt": context["scoring"][:16000],
            "tagging_excerpt": context["tagging"][:16000],
        },
    }
    return [
        {"role": "system", "content": context["prompt"]},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def _load_openclaw_gateway_config() -> Dict[str, Any]:
    config_path = Path.home() / '.openclaw' / 'openclaw.json'
    raw = json.loads(config_path.read_text(encoding='utf-8'))
    gateway = raw.get('gateway', {}) or {}
    auth = gateway.get('auth', {}) or {}
    return {
        'port': gateway.get('port', 18789),
        'token': auth.get('token'),
    }


def call_openai_compatible(model: str, messages: List[Dict[str, str]]) -> str:
    cfg = _load_openclaw_gateway_config()
    token = os.getenv('OPENCLAW_GATEWAY_TOKEN') or cfg.get('token')
    if not token:
        raise RuntimeError('OPENCLAW gateway token is not set')

    agent_id = os.getenv('MASTER_OPENCLAW_AGENT', 'e-commerce-scout')
    user_text = next((m.get('content', '') for m in messages if m.get('role') == 'user'), '')
    system_text = '\n\n'.join(m.get('content', '') for m in messages if m.get('role') in {'system', 'developer'})

    payload = {
        'model': 'openclaw',
        'input': [
            {'type': 'message', 'role': 'system', 'content': [{'type': 'input_text', 'text': system_text}]},
            {'type': 'message', 'role': 'user', 'content': [{'type': 'input_text', 'text': user_text}]},
        ],
        'max_output_tokens': 12000,
    }

    req = urllib.request.Request(
        url=f"http://127.0.0.1:{cfg.get('port', 18789)}/v1/responses",
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}',
            'x-openclaw-agent-id': agent_id,
        },
        method='POST',
    )

    with urllib.request.urlopen(req, timeout=240) as resp:
        body = json.loads(resp.read().decode('utf-8'))

    outputs = body.get('output') or []
    for item in outputs:
        for part in item.get('content', []) or []:
            if part.get('type') == 'output_text' and part.get('text'):
                return part['text']
    raise RuntimeError('OpenClaw responses endpoint returned no output_text')


def extract_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON object found in model output")
    return json.loads(match.group(0))
