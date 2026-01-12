'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';

interface FileUploadProps {
  onUpload: (files: File[]) => void;
  isProcessing: boolean;
  disabled: boolean;
}

export default function FileUpload({ onUpload, isProcessing, disabled }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!disabled && acceptedFiles.length > 0) {
        onUpload(acceptedFiles);
      }
    },
    [onUpload, disabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    disabled: disabled || isProcessing,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const rootProps = getRootProps();

  return (
    <div {...rootProps}>
      <motion.div
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
          isDragActive || dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        whileHover={!disabled ? { scale: 1.01 } : {}}
        whileTap={!disabled ? { scale: 0.99 } : {}}
    >
      <input {...getInputProps()} />

      {isProcessing ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-gray-600 dark:text-gray-400">문서 처리 중...</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-center">
            <svg
              className={`h-12 w-12 ${
                isDragActive ? 'text-blue-500' : 'text-gray-400'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <p className="mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">
            {isDragActive ? '파일을 여기에 놓으세요' : '파일을 드래그하거나 클릭하세요'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            .txt, .md 파일 지원
          </p>

          {disabled && (
            <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              API 키를 먼저 설정해주세요
            </p>
          )}
        </>
      )}
      </motion.div>
    </div>
  );
}
