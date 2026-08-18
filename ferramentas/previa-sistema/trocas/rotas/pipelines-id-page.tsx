// Previa estatica: o export precisa saber quais ids gerar. O conteudo continua
// sendo o mesmo componente client do produto.
import PipelineBoardClient from './board-client';

export function generateStaticParams() {
  return [{ id: 'demo_pipe_01' }, { id: 'cmrxyv7t70001k6z81436958d' }];
}

export default function PipelineBoardPage() {
  return <PipelineBoardClient />;
}
