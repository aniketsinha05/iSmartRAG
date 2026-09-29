import os
import chromadb

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")
client = chromadb.PersistentClient(path=DB_PATH)
collection = client.get_or_create_collection("documents")

def chunk_text(text, size=800, overlap=100):
    chunks, start = [], 0
    while start < len(text):
        chunks.append(text[start:start + size])
        start += size - overlap
    return chunks

def add_document(text, source, doc_type):
    chunks = chunk_text(text)
    collection.upsert(
        documents=chunks,
        ids=[f"{source}_{i}" for i in range(len(chunks))],
        metadatas=[{"source": source, "type": doc_type}] * len(chunks),
    )
    return len(chunks)

def search(query, n_results=3):
    return collection.query(query_texts=[query], n_results=n_results)

if __name__ == "__main__":
    add_document("RAG combines search with an LLM to answer questions.", "test.txt", "test")
    print(search("What is RAG?"))