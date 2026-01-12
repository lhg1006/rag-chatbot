import { Chunk } from '@/types/rag';

const CHUNK_SIZE = 500; // 문자 수
const CHUNK_OVERLAP = 100; // 겹치는 문자 수

export function chunkText(
  text: string,
  documentId: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): Omit<Chunk, 'embedding'>[] {
  const chunks: Omit<Chunk, 'embedding'>[] = [];

  // 텍스트 정규화
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (normalizedText.length === 0) {
    return [];
  }

  // 문단 단위로 먼저 분리
  const paragraphs = normalizedText.split(/\n\n+/);
  let currentChunk = '';
  let currentStart = 0;
  let textIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();

    if (currentChunk.length + trimmedParagraph.length + 2 <= chunkSize) {
      // 현재 청크에 추가
      if (currentChunk) {
        currentChunk += '\n\n' + trimmedParagraph;
      } else {
        currentChunk = trimmedParagraph;
        currentStart = textIndex;
      }
    } else {
      // 현재 청크 저장하고 새 청크 시작
      if (currentChunk) {
        chunks.push({
          id: `${documentId}-chunk-${chunks.length}`,
          documentId,
          content: currentChunk,
          startIndex: currentStart,
          endIndex: currentStart + currentChunk.length,
        });
      }

      // 긴 문단은 문장 단위로 분리
      if (trimmedParagraph.length > chunkSize) {
        const sentences = trimmedParagraph.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        currentStart = textIndex;

        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= chunkSize) {
            currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
          } else {
            if (currentChunk) {
              chunks.push({
                id: `${documentId}-chunk-${chunks.length}`,
                documentId,
                content: currentChunk,
                startIndex: currentStart,
                endIndex: currentStart + currentChunk.length,
              });
            }
            currentChunk = sentence;
            currentStart = textIndex;
          }
        }
      } else {
        currentChunk = trimmedParagraph;
        currentStart = textIndex;
      }
    }

    textIndex += paragraph.length + 2; // +2 for \n\n
  }

  // 마지막 청크 저장
  if (currentChunk) {
    chunks.push({
      id: `${documentId}-chunk-${chunks.length}`,
      documentId,
      content: currentChunk,
      startIndex: currentStart,
      endIndex: currentStart + currentChunk.length,
    });
  }

  return chunks;
}

export function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
    };

    reader.readAsText(file);
  });
}
