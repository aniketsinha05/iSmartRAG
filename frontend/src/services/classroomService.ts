import { apiClient } from "./apiClient";
import { toSource } from "./sourcesService";
import type { ApiSource } from "./sourcesService";
import type { ChatSummary, Classroom, Message, Source } from "../types";

type ApiClassroom = {
  id: number;
  name: string;
  document_count: number;
};

type ApiChat = {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
};

function toClassroom(item: ApiClassroom): Classroom {
  return {
    id: item.id,
    name: item.name,
    documentCount: item.document_count,
  };
}

function toSummary(item: ApiChat): ChatSummary {
  return {
    id: item.id,
    title: item.title,
    updatedAt: item.updated_at,
    messageCount: item.message_count,
  };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// ── Classrooms ────────────────────────────────────────────────────────────────

export async function fetchClassrooms(): Promise<Classroom[]> {
  const response = await apiClient("/classrooms");
  const data = await response.json();
  return (data.classrooms as ApiClassroom[]).map(toClassroom);
}

export async function createClassroom(name: string): Promise<Classroom> {
  const response = await apiClient("/classrooms", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });
  return toClassroom(await response.json());
}

export async function renameClassroom(
  id: number,
  name: string
): Promise<Classroom> {
  const response = await apiClient(`/classrooms/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });
  return toClassroom(await response.json());
}

export async function deleteClassroom(id: number): Promise<void> {
  await apiClient(`/classrooms/${id}`, { method: "DELETE" });
}

// ── Classroom documents (identified by document id) ──────────────────────────

export async function fetchClassroomDocuments(
  classroomId: number
): Promise<{ classroom: Classroom; documents: Source[] }> {
  const response = await apiClient(`/classrooms/${classroomId}/documents`);
  const data = await response.json();
  return {
    classroom: toClassroom(data.classroom as ApiClassroom),
    documents: (data.documents as ApiSource[]).map(toSource),
  };
}

export async function importDocuments(
  classroomId: number,
  documentIds: number[]
): Promise<{ added: number[]; skipped: number[] }> {
  const response = await apiClient(`/classrooms/${classroomId}/documents`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ document_ids: documentIds }),
  });
  return response.json();
}

export async function removeClassroomDocument(
  classroomId: number,
  documentId: number
) {
  await apiClient(`/classrooms/${classroomId}/documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function uploadToClassroom(classroomId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient(`/classrooms/${classroomId}/upload`, {
    method: "POST",
    body: formData,
  });
  return response.json();
}

// ── General chat persistence (all Chat-page conversations) ───────────────────

export async function fetchGeneralChats(): Promise<ChatSummary[]> {
  const response = await apiClient("/chats");
  const data = await response.json();
  return (data.chats as ApiChat[]).map(toSummary);
}

export async function createGeneralChat(): Promise<{ id: string }> {
  const response = await apiClient("/chats", { method: "POST" });
  return response.json();
}

export async function fetchGeneralChat(
  chatId: string
): Promise<{ id: string; title: string; messages: Message[] }> {
  const response = await apiClient(`/chats/${chatId}`);
  return response.json();
}

export async function deleteGeneralChat(chatId: string): Promise<void> {
  await apiClient(`/chats/${chatId}`, { method: "DELETE" });
}