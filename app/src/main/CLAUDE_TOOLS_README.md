# Como Adicionar MCP Tools ao Claude Agent

## Arquivo Criado

Foi criado `claudeAgentTools.ts` com ferramentas de exemplo baseadas no código funcionando do supermemory.

## Para Ativar as Tools

### 1. Importar o Servidor de Tools

No arquivo `claudeAgent.ts`, adicione o import:

```typescript
import { createSurfTools } from './claudeAgentTools'
```

### 2. Adicionar ao queryOptions

Modifique o `queryOptions` para incluir as tools:

```typescript
const queryOptions: Record<string, unknown> = {
  model: payload.model || 'claude-sonnet-4-5-20250929',

  // ... outras configurações ...

  // Adicionar MCP servers
  mcpServers: {
    'surf-tools': createSurfTools()
  }

  // ... resto das configurações ...
}
```

## Tools Disponíveis (Exemplos)

As seguintes tools foram criadas como **placeholders** que você pode implementar:

### 1. searchTabs

- **Descrição**: Buscar tabs abertas por título, URL ou conteúdo
- **Parâmetros**:
  - `query` (string): Query de busca
  - `limit` (number): Máximo de resultados (padrão: 10)
  - `includeContent` (boolean): Incluir conteúdo da página (padrão: false)

### 2. getBrowserHistory

- **Descrição**: Recuperar histórico do navegador
- **Parâmetros**:
  - `timeRangeHours` (number): Horas de histórico (padrão: 24, max: 168)
  - `limit` (number): Máximo de entradas (padrão: 20)

### 3. bookmarkPage

- **Descrição**: Adicionar página aos favoritos
- **Parâmetros**:
  - `url` (string): URL para adicionar
  - `title` (string): Título do bookmark
  - `tags` (string[]): Tags opcionais

## Como Implementar as Tools

Para cada tool em `claudeAgentTools.ts`:

1. Substitua a lógica mock pela implementação real
2. Integre com o backend Rust se necessário
3. Teste a tool isoladamente
4. Valide os schemas com Zod

### Exemplo de Implementação Real

```typescript
tool(
  'searchTabs',
  'Search through open browser tabs',
  { query: z.string(), limit: z.number().default(10) },
  async ({ query, limit }) => {
    try {
      // Chamar backend Rust ou API do Electron
      const tabs = await getOpenTabs() // Sua implementação
      const filtered = tabs
        .filter((tab) => tab.title.includes(query) || tab.url.includes(query))
        .slice(0, limit)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query,
                count: filtered.length,
                tabs: filtered
              },
              null,
              2
            )
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`
          }
        ],
        isError: true
      }
    }
  }
)
```

## Próximos Passos

1. **Implementar tools reais** - Substituir placeholders por lógica funcional
2. **Adicionar mais tools** - Criar ferramentas específicas do Surf
3. **Testar integração** - Verificar que Claude consegue usar as tools
4. **Documentar uso** - Adicionar exemplos de como Claude pode usar cada tool

## Referência

Baseado na implementação funcionando de:

- `/Users/guilhermevarela/Public/supermemory/apps/api/src/services/claude-agent-tools.ts`
