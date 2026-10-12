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

// ── Classrooms ────────────────────────────────────────────────────────────────

export async function fetchClassrooms(): Promise<Classroom[]> {
  const response = await apiClient("/classrooms");
  const data = await response.json();
  return (data.classrooms as ApiClassroom[]).map(toClassroom);
}







export async function createClassroom(name: string): Promise<Classroom> {
  const response = await apiClient("/classrooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return toClassroom(await response.json());
}

export async function deleteClassroom(id: number): Promise<void> {
  await apiClient(`/classrooms/${id}`, { method: "DELETE" });
}








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
  names: string[]
): Promise<{ added: string[]; skipped: string[] }> {
  const response = await apiClient(`/classrooms/${classroomId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names }),
  });
  return response.json();
}

export async function removeClassroomDocument(
  classroomId: number,
  name: string
) {
  await apiClient(
    `/classrooms/${classroomId}/documents?name=${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
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

// ── Multi-classroom ask (persists to general bucket) ─────────────────────────

export async function askMultipleClassrooms(
  classroomIds: number[],
  question: string,
  nResults = 3,
  chatId?: string,
) {
  const params = new URLSearchParams({
    classroom_ids: classroomIds.join(","),
    question,
    n_results: String(nResults),
  });
  if (chatId) params.set("chat_id", chatId);
  const response = await apiClient(`/classrooms/multi/ask?${params.toString()}`);
  return response.json();
}

// ── General chat persistence (bucket 0 on the backend) ───────────────────────
// All Chat-page conversations are stored here regardless of classroom filter.

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

// ── Kept for any legacy callers (classroom-specific chat endpoints) ───────────

export async function askClassroom(
  classroomId: number,
  question: string,
  nResults = 3,
  chatId?: string
) {
  const params = new URLSearchParams({
    question,
    n_results: String(nResults),
  });
  if (chatId) params.set("chat_id", chatId);
  const response = await apiClient(
    `/classrooms/${classroomId}/ask?${params.toString()}`
  );
  return response.json();
}

export async function fetchChats(classroomId: number): Promise<ChatSummary[]> {
  const response = await apiClient(`/classrooms/${classroomId}/chats`);
  const data = await response.json();
  return (data.chats as ApiChat[]).map(toSummary);
}

export async function createChat(classroomId: number): Promise<{ id: string }> {
  const response = await apiClient(`/classrooms/${classroomId}/chats`, {
    method: "POST",
  });
  return response.json();
}

export async function fetchChat(
  classroomId: number,
  chatId: string
): Promise<{ id: string; title: string; messages: Message[] }> {
  const response = await apiClient(`/classrooms/${classroomId}/chats/${chatId}`);
  return response.json();
}

export async function deleteChat(classroomId: number, chatId: string) {
  await apiClient(`/classrooms/${classroomId}/chats/${chatId}`, {
    method: "DELETE",
  });
}
