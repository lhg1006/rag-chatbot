import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Document, Chunk, VectorSearchResult } from '@/types/rag';

interface RAGDatabase extends DBSchema {
  documents: {
    key: string;
    value: Document;
    indexes: { 'by-name': string };
  };
  chunks: {
    key: string;
    value: Chunk;
    indexes: { 'by-document': string };
  };
}

const DB_NAME = 'rag-chatbot-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<RAGDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase<RAGDatabase>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<RAGDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Documents store
      if (!db.objectStoreNames.contains('documents')) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('by-name', 'name');
      }

      // Chunks store
      if (!db.objectStoreNames.contains('chunks')) {
        const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
        chunkStore.createIndex('by-document', 'documentId');
      }
    },
  });

  return dbInstance;
}

// 코사인 유사도 계산
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// Document 저장
export async function saveDocument(document: Document): Promise<void> {
  const db = await getDB();
  await db.put('documents', document);
}

// Chunk 저장
export async function saveChunks(chunks: Chunk[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('chunks', 'readwrite');

  for (const chunk of chunks) {
    await tx.store.put(chunk);
  }

  await tx.done;
}

// 모든 문서 가져오기
export async function getAllDocuments(): Promise<Document[]> {
  const db = await getDB();
  return db.getAll('documents');
}

// 문서 삭제
export async function deleteDocument(documentId: string): Promise<void> {
  const db = await getDB();

  // 문서 삭제
  await db.delete('documents', documentId);

  // 관련 청크들 삭제
  const tx = db.transaction('chunks', 'readwrite');
  const index = tx.store.index('by-document');
  const chunks = await index.getAllKeys(documentId);

  for (const key of chunks) {
    await tx.store.delete(key);
  }

  await tx.done;
}

// 벡터 검색
export async function searchSimilarChunks(
  queryEmbedding: number[],
  topK: number = 5,
  threshold: number = 0.5
): Promise<VectorSearchResult[]> {
  const db = await getDB();

  const [chunks, documents] = await Promise.all([
    db.getAll('chunks'),
    db.getAll('documents'),
  ]);

  const documentMap = new Map(documents.map((d) => [d.id, d]));

  // 모든 청크와 유사도 계산
  const results: VectorSearchResult[] = chunks
    .map((chunk) => {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      const doc = documentMap.get(chunk.documentId);
      return {
        chunk,
        similarity,
        documentName: doc?.name || 'Unknown',
      };
    })
    .filter((r) => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return results;
}

// 전체 데이터 초기화
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('documents');
  await db.clear('chunks');
}

// 통계
export async function getStats(): Promise<{
  documentCount: number;
  chunkCount: number;
}> {
  const db = await getDB();
  const [documentCount, chunkCount] = await Promise.all([
    db.count('documents'),
    db.count('chunks'),
  ]);
  return { documentCount, chunkCount };
}
