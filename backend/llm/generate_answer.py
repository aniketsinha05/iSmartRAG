import os

from dotenv import load_dotenv
from groq import Groq

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
load_dotenv(os.path.join(ROOT, ".env"))

MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = (
    "You are MyBookAI, a study assistant. Answer the question using ONLY "
    "the context given. If the answer is not in the context, say "
    "'I could not find this in your documents.' Keep the answer short and clear."
)


def generate_answer(question, chunks):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is missing in the .env file")

    client = Groq(api_key=api_key)
    context = "\n\n---\n\n".join(chunks)

    response = client.chat.completions.create(
        model=MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}",
            },
        ],
    )
    return response.choices[0].message.content