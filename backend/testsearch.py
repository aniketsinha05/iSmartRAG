from vector_store import search

results = search("what is in this excel file")
for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
    print(meta["source"], "->", doc[:300])
    print("-" * 40)
    