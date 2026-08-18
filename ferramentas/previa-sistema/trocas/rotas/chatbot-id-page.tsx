import ChatbotEditorClient from './editor-client';

export function generateStaticParams() {
  return [{ id: 'sem-fluxo' }];
}

export default function ChatbotEditorPage() {
  return <ChatbotEditorClient />;
}
