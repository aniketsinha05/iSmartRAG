import { apiClient } from "./apiClient";

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient("/upload", {
    method: "POST",
    body: formData,
  });

  return response.json();
}

// old name kept so existing imports keep working
export const uploadPdf = uploadFile;