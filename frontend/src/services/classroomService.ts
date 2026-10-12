import { apiClient } from "./apiClient";
import { toSource } from "./sourcesService";
import type { ApiSource } from "./sourcesService";
import type { ChatSummary, Classroom, Message, Source } from "../types";

type ApiClassroom = {
  id: number;
  name: string;
  document_count: number;
};

function toClassroom(item: ApiClassroom): Classroom {
  return {
    id: item.id,
    name: item.name,
    documentCount: item.document_count,
  };
}

export async function fetchClassrooms(): Promise<Classroom[]> {
  const response = await apiClient("/classrooms");
  const data = await response.json();

  return (data.classrooms as ApiClassroom[]).map(toClassroom);
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

// removes the document from this classroom only (the original stays in the Knowledge Base)
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

// pass chatId and the backend saves the question and the answer in that chat
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

type ApiChat = {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
};

// saved chats of a classroom, newest first
export async function fetchChats(classroomId: number): Promise<ChatSummary[]> {
  const response = await apiClient(`/classrooms/${classroomId}/chats`);
  const data = await response.json();

  return (data.chats as ApiChat[]).map((item) => ({
    id: item.id,
    title: item.title,
    updatedAt: item.updated_at,
    messageCount: item.message_count,
  }));
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