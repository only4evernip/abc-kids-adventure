from __future__ import annotations

import json
import os
import re
import urllib.request
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


def call_openai_compatible(model: str, messages: List[Dict[str, str]]) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    req = urllib.request.Request(
        url=base_url.rstrip("/") + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=180) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["choices"][0]["message"]["content"]


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
