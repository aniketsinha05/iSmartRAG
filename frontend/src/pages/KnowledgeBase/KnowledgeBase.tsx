import { useState } from "react";
import type { Source } from "../../types";
import SourceFilters from "./SourceFilters";
import SourceList from "./SourceList";

type KnowledgeBaseProps = {
  sources: Source[];
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
};

export default function KnowledgeBase({
  sources,
  setSources,
}: KnowledgeBaseProps) {
  const [url, setUrl] = useState("");
  const [search, setSearch] = useState("");

  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");

  const [uploadMessage, setUploadMessage] = useState("");

  const addFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadStatus("error");
      setUploadMessage("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    setUploadStatus("processing");
    setUploadMessage(
      "⏳ Your PDF is being uploaded and processed..."
    );

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/upload-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "PDF upload failed.");
      }

      const newSource: Source = {
        name: data.filename,
        type: "PDF",
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      };

      setSources((current) => [...current, newSource]);

      setUploadStatus("success");
      setUploadMessage(
        `✅ PDF uploaded successfully! ${data.pages} page${
          data.pages === 1 ? "" : "s"
        } processed and ${data.text_length.toLocaleString()} characters of text extracted.`
      );
    } catch (error) {
      console.error("PDF upload error:", error);

      setUploadStatus("error");
      setUploadMessage(
        "❌ Could not connect to the iSmartRAG backend. Make sure the backend is running."
      );
    }

    event.target.value = "";
  };

  const addUrl = () => {
    const cleanUrl = url.trim();

    if (!cleanUrl) return;

    const newSource: Source = {
      name: cleanUrl,
      type: "WEB",
      size: "Website",
    };

    setSources((current) => [...current, newSource]);
    setUrl("");
  };

  const deleteSource = (index: number) => {
    setSources((current) =>
      current.filter((_, i) => i !== index)
    );
  };

  const filteredSources = sources.filter((source) =>
    source.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="page-intro">
        <h1>Your Knowledge Base</h1>
        <p>
          Add study materials and websites that iSmartRAG can use
          as sources.
        </p>
      </div>

      {uploadStatus !== "idle" && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            borderRadius: "12px",
            background:
              uploadStatus === "success"
                ? "#ecfdf3"
                : uploadStatus === "error"
                ? "#fff1f2"
                : "#f5f3ff",
            border:
              uploadStatus === "success"
                ? "1px solid #bbf7d0"
                : uploadStatus === "error"
                ? "1px solid #fecdd3"
                : "1px solid #ddd6fe",
            color:
              uploadStatus === "success"
                ? "#166534"
                : uploadStatus === "error"
                ? "#be123c"
                : "#6d28d9",
            fontWeight: 500,
          }}
        >
          {uploadMessage}
        </div>
      )}

      <div className="upload-grid">
        <label className="upload-card">
          <input
            type="file"
            accept=".pdf"
            onChange={addFile}
            hidden
            disabled={uploadStatus === "processing"}
          />

          <div className="upload-icon">↑</div>
          <h3>Upload PDF</h3>
          <p>PDF files only</p>

          <span className="upload-button">
            {uploadStatus === "processing"
              ? "Processing..."
              : "Choose File"}
          </span>
        </label>

        <div className="url-card">
          <div className="upload-icon">🌐</div>

          <h3>Add a website</h3>
          <p>Use a website as a knowledge source.</p>

          <div className="url-input-row">
            <input
              value={url}
              onChange={(event) =>
                setUrl(event.target.value)
              }
              placeholder="https://example.com"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addUrl();
                }
              }}
            />

            <button onClick={addUrl}>Add</button>
          </div>
        </div>
      </div>

      <div className="sources-section">
        <div className="sources-header">
          <div>
            <h2>Sources</h2>
            <p>
              {sources.length} sources in your knowledge base
            </p>
          </div>

          <SourceFilters
            search={search}
            setSearch={setSearch}
          />
        </div>

        <SourceList
          sources={sources}
          filteredSources={filteredSources}
          onDelete={deleteSource}
        />
      </div>
    </div>
  );
}