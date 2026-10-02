import { apiClient } from "./apiClient";

export async function uploadPdf(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient("/upload-pdf", {
    method: "POST",
    body: formData,
  });

  return response.json();
}