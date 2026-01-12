import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "문서 기반 AI 챗봇",
  description: "문서를 업로드하고 AI에게 질문하세요. 벡터 검색 기반 RAG 시스템.",
  keywords: ["RAG", "챗봇", "AI", "문서 검색", "벡터 검색", "OpenAI"],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
