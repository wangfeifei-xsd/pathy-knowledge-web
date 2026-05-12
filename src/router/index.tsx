import { createHashRouter, Navigate } from 'react-router-dom'
import { Shell } from '../layouts/Shell'
import { DialogueSummonTest } from '../pages/knowledgeRecall/DialogueSummonTest'
import { NaturalLanguageRecall } from '../pages/knowledgeRecall/NaturalLanguageRecall'
import { StopwordsConfig } from '../pages/knowledgeRecall/StopwordsConfig'
import { Home } from '../pages/Home'
import { Layers } from '../pages/Layers'
import { StorageStructure } from '../pages/StorageStructure'
import { CompileTask } from '../pages/llmTasks/CompileTask'
import { LintReport } from '../pages/llmTasks/LintReport'
import { PolishTextPage } from '../pages/llmTasks/PolishTextPage'
import { ModelSettings } from '../pages/ModelSettings'
import { SimpleModelSettings } from '../pages/SimpleModelSettings'

const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'layers', element: <Layers /> },
      { path: 'storage/structure', element: <StorageStructure /> },
      { path: 'tasks', element: <Navigate to="/tasks/compile" replace /> },
      { path: 'tasks/compile', element: <CompileTask /> },
      { path: 'tasks/lint', element: <LintReport /> },
      { path: 'tasks/polish', element: <PolishTextPage /> },
      { path: 'knowledge-recall/nl', element: <NaturalLanguageRecall /> },
      { path: 'knowledge-recall/dialogue-test', element: <DialogueSummonTest /> },
      { path: 'knowledge-recall/stopwords', element: <StopwordsConfig /> },
      { path: 'settings/llm', element: <ModelSettings /> },
      {
        path: 'settings/embedding',
        element: (
          <SimpleModelSettings
            title="Embedding模型配置"
            endpoint="/api/v1/settings/embedding"
            testEndpoint="/api/v1/settings/embedding/test"
            lockKey="embedding_model"
            keyFileLabel=".pathy/embedding_api_key"
          />
        ),
      },
      {
        path: 'settings/rerank',
        element: (
          <SimpleModelSettings
            title="Rerank模型配置"
            endpoint="/api/v1/settings/rerank"
            testEndpoint="/api/v1/settings/rerank/test"
            lockKey="rerank_model"
            keyFileLabel=".pathy/rerank_api_key"
          />
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default router
