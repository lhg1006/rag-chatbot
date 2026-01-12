'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { validateApiKey } from '@/lib/openai';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
}

export default function ApiKeyModal({ isOpen, onClose, onSave }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!apiKey.trim()) {
      setError('API 키를 입력해주세요.');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      setError('유효한 OpenAI API 키 형식이 아닙니다.');
      return;
    }

    setIsValidating(true);

    try {
      const isValid = await validateApiKey(apiKey);
      if (isValid) {
        onSave(apiKey);
        setApiKey('');
      } else {
        setError('API 키가 유효하지 않습니다.');
      }
    } catch {
      setError('API 키 검증 중 오류가 발생했습니다.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
              OpenAI API 키 설정
            </h2>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              문서 임베딩과 AI 답변 생성을 위해 필요합니다.
              키는 브라우저에만 저장됩니다.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />

              {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isValidating}
                  className="flex-1 rounded-lg bg-blue-500 px-4 py-3 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {isValidating ? '검증 중...' : '저장'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
