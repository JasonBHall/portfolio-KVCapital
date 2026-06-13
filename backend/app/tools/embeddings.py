"""
Embedding helper — wraps OpenAI text-embedding-3-small.
Returns zero vectors in offline mode (no API key set).
See design/decisions.md for model choice rationale.
"""

import os
from functools import lru_cache

EMBEDDING_DIM = 1536


async def embed_text(text: str) -> list[float]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return [0.0] * EMBEDDING_DIM

    from openai import AsyncOpenAI
    client = _get_client(api_key)
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


@lru_cache(maxsize=1)
def _get_client(api_key: str):
    from openai import AsyncOpenAI
    return AsyncOpenAI(api_key=api_key)
