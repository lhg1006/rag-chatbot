export interface Document {
  id: string;
  name: string;
  content: string;
  chunks: Chunk[];
  uploadedAt: Date;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  startIndex: number;
  endIndex: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChunkReference[];
  timestamp: Date;
}

export interface ChunkReference {
  documentName: string;
  content: string;
  similarity: number;
}

export interface VectorSearchResult {
  chunk: Chunk;
  similarity: number;
  documentName: string;
}
