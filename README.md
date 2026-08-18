# Previa-Clientes

Hospedagem das previas de trabalho, uma pasta por projeto, servidas pelo GitHub Pages.
O link de cada previa e mandado direto para o cliente.

## No ar

| Projeto | Pasta | Link |
|---|---|---|
| Site da Clinica Harmonelle | `harmonelle-site/` | https://marcosbautitz.github.io/Previa-Clientes/harmonelle-site/ |
| Sistema de atendimento da Harmonelle | `sistema-harmonelle/` | https://marcosbautitz.github.io/Previa-Clientes/sistema-harmonelle/ |

## Como colocar uma previa nova

```
./publicar.sh <nome-da-pasta> <caminho do html>
```

Exemplo:

```
./publicar.sh clinica-fulano ~/Documents/.../entregas/site-v1-autossuficiente.html
```

O script cria a pasta, copia o HTML como `index.html`, insere o `noindex`,
faz o commit e sobe. Ao terminar ele imprime o link para mandar ao cliente.

Se a previa tiver imagem de compartilhamento ou outros arquivos, copie na mao
para dentro da pasta antes de subir.

## Duas regras que evitam dor de cabeca

1. **Todas as previas levam `noindex`**, mais o `robots.txt` da raiz que fecha o
   repositorio inteiro. Previa nao aprovada nao pode aparecer na busca do Google
   e concorrer com o site definitivo do cliente.
2. **O repositorio e publico**, entao a lista de pastas e visivel para quem abrir
   o endereco no GitHub. O conteudo de cada previa so aparece para quem tem o link,
   mas os nomes das pastas nao sao segredo.

## Como atualizar uma previa que ja esta no ar

Rode o mesmo `publicar.sh` com a mesma pasta. Ele sobrescreve e sobe de novo.
O link nao muda, entao o cliente ve a versao nova recarregando a pagina.
