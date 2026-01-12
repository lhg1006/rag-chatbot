'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import ApiKeyModal from '@/components/ApiKeyModal';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import ChatInterface from '@/components/ChatInterface';
import { Document, Chunk, ChatMessage, ChunkReference } from '@/types/rag';
import { chunkText, extractTextFromFile } from '@/lib/chunker';
import { createEmbeddings, createEmbedding, streamChat } from '@/lib/openai';
import {
  saveDocument,
  saveChunks,
  getAllDocuments,
  deleteDocument,
  searchSimilarChunks,
} from '@/lib/vectorStore';

const API_KEY_STORAGE_KEY = 'rag-chatbot-api-key';

export default function Home() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isDark, setIsDark] = useState(false);

  // 초기화
  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedKey) setApiKey(savedKey);

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);

    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const docs = await getAllDocuments();
    setDocuments(docs);
  };

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    setApiKey(key);
    setIsModalOpen(false);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey(null);
  };

  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
  };

  // 파일 업로드 처리
  const handleFileUpload = useCallback(
    async (files: File[]) => {
      if (!apiKey) {
        setIsModalOpen(true);
        return;
      }

      setIsProcessing(true);

      try {
        for (const file of files) {
          // 텍스트 추출
          const text = await extractTextFromFile(file);

          // 문서 ID 생성
          const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

          // 청킹
          const chunksWithoutEmbedding = chunkText(text, documentId);

          if (chunksWithoutEmbedding.length === 0) {
            console.warn('No chunks created from file:', file.name);
            continue;
          }

          // 임베딩 생성
          const embeddings = await createEmbeddings(
            apiKey,
            chunksWithoutEmbedding.map((c) => c.content)
          );

          // 청크에 임베딩 추가
          const chunks: Chunk[] = chunksWithoutEmbedding.map((chunk, i) => ({
            ...chunk,
            embedding: embeddings[i],
          }));

          // 문서 생성
          const document: Document = {
            id: documentId,
            name: file.name,
            content: text,
            chunks,
            uploadedAt: new Date(),
          };

          // 저장
          await saveDocument(document);
          await saveChunks(chunks);

          // 상태 업데이트
          setDocuments((prev) => [...prev, document]);
        }
      } catch (error) {
        console.error('File upload error:', error);
        alert('파일 처리 중 오류가 발생했습니다.');
      } finally {
        setIsProcessing(false);
      }
    },
    [apiKey]
  );

  // 문서 삭제
  const handleDeleteDocument = async (documentId: string) => {
    await deleteDocument(documentId);
    setDocuments((prev) => prev.filter((d) => d.id !== documentId));
  };

  // 메시지 전송
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!apiKey || documents.length === 0) return;

      // 사용자 메시지 추가
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent('');

      try {
        // 질문 임베딩
        const queryEmbedding = await createEmbedding(apiKey, content);

        // 유사 청크 검색
        const searchResults = await searchSimilarChunks(queryEmbedding, 5, 0.3);

        // 컨텍스트 생성
        const context: ChunkReference[] = searchResults.map((r) => ({
          documentName: r.documentName,
          content: r.chunk.content,
          similarity: r.similarity,
        }));

        // 스트리밍 응답
        let fullResponse = '';
        for await (const chunk of streamChat(apiKey, content, context)) {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        }

        // AI 메시지 추가
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: fullResponse,
          sources: context,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error('Chat error:', error);
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: '죄송합니다. 응답 생성 중 오류가 발생했습니다.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        setStreamingContent('');
      }
    },
    [apiKey, documents]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              RAG Chatbot
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              문서 기반 AI 챗봇
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              {isDark ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            {apiKey ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  API 연결됨
                </span>
                <button
                  onClick={handleClearApiKey}
                  className="text-sm text-gray-500 hover:text-red-500"
                >
                  초기화
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsModalOpen(true)}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
              >
                API 키 설정
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: Upload & Documents */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                문서 업로드
              </h2>
              <FileUpload
                onUpload={handleFileUpload}
                isProcessing={isProcessing}
                disabled={!apiKey}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <DocumentList
                documents={documents}
                onDelete={handleDeleteDocument}
              />
            </motion.div>
          </div>

          {/* Right: Chat */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                AI 채팅
              </h2>
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                disabled={!apiKey || documents.length === 0}
                streamingContent={streamingContent}
              />
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Built with Next.js, OpenAI & IndexedDB
          </p>
          <p className="mt-1 text-sm text-gray-400">
            <a href="https://github.com/lhg1006" target="_blank" className="hover:text-blue-500">
              @lhg1006
            </a>
          </p>
        </div>
      </footer>

      <ApiKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveApiKey}
      />
    </div>
  );
}
