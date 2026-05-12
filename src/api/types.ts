export type LayerName = 'raw' | 'wiki' | 'schema'

export interface HealthResponse {
  status: string
  service: string
}

export type LLMFieldSource = 'env' | 'file' | 'default'

export interface ConfigSummaryResponse {
  data_root: string
  data_root_resolved: string
  llm_base_url: string | null
  llm_model: string
  embedding_base_url: string | null
  embedding_model: string
  rerank_base_url: string | null
  rerank_model: string
  layers: string[]
}

export interface LLMSettingsResponse {
  openai_model: string
  openai_model_source: LLMFieldSource
  openai_base_url: string | null
  openai_base_url_source: LLMFieldSource
  openai_timeout_seconds: number
  openai_timeout_source: LLMFieldSource
  openai_max_tokens: number
  openai_max_tokens_source: LLMFieldSource
  openai_api_key_configured: boolean
  env_locks: Record<string, boolean>
  runtime_llm_json: string
}

export interface BasicModelSettingsResponse {
  model: string
  model_source: LLMFieldSource
  openai_base_url: string | null
  openai_base_url_source: LLMFieldSource
  openai_timeout_seconds: number
  openai_timeout_source: LLMFieldSource
  openai_max_tokens: number
  openai_max_tokens_source: LLMFieldSource
  openai_api_key_configured: boolean
  env_locks: Record<string, boolean>
  runtime_llm_json: string
}

export interface BasicModelSettingsUpdateResult {
  settings: BasicModelSettingsResponse
  warnings: string[]
}

export interface LLMSettingsUpdateRequest {
  openai_model?: string
  openai_base_url?: string
  openai_timeout_seconds?: number
  openai_max_tokens?: number
  openai_api_key?: string
}

export interface LLMSettingsUpdateResult {
  settings: LLMSettingsResponse
  warnings: string[]
}

export interface LLMConnectionTestRequest {
  openai_model?: string
  openai_base_url?: string
}

export interface LLMTestResponse {
  ok: boolean
  model: string
  base_url: string | null
  elapsed_ms: number
  message: string
  usage?: TaskUsage
  error?: string
}

export interface DirEntry {
  name: string
  path: string
  is_dir: boolean
  size: number | null
  embedding_status?: 'embedded' | 'stale' | 'not_embedded' | null
}

export interface ListLayerResponse {
  layer: LayerName
  prefix: string
  entries: DirEntry[]
}

export interface LayerFileListResponse {
  layer: LayerName
  paths: string[]
  truncated: boolean
}

export interface FileContentResponse {
  layer: LayerName
  path: string
  content: string
  size: number
}

export interface CompileTaskRequest {
  input_paths: string[]
  output_path: string
  schema_paths?: string[]
  extra_instructions?: string
}

export interface TaskUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export interface CompileTaskResponse {
  model: string
  usage?: TaskUsage
  output_path: string
  written_files: string[]
  message: string
}

export interface LintTaskRequest {
  wiki_paths?: string[]
  auto_fix?: boolean
  max_files?: number
}

export interface LintTaskResponse {
  model: string
  usage?: TaskUsage
  report: string
  files_inspected: string[]
  auto_fix_applied: boolean
}

export interface PolishTextRequest {
  content: string
  instruction?: string
}

export interface PolishTextResponse {
  content: string
  model: string
  usage?: TaskUsage
}

/** 与服务端 DialogueRecallBaseParams 一致：双路召回扫描参数（不含 LLM system） */
export interface DialogueRecallScanRequest {
  query: string
  wiki_prefix?: string
  max_files?: number
  bm25_top_n?: number
  vector_top_n?: number
  top_k_chunks?: number
  chunk_max_chars?: number
  context_budget_chars?: number
}

/** 仅召回 API（/dialogue/recall） */
export type DialogueRecallRequest = DialogueRecallScanRequest

export interface DialogueRecallTestRequest extends DialogueRecallScanRequest {
  system_prompt?: string
}

export interface DialogueRecallHit {
  path: string
  score: number
  snippet: string
}

/** 与 DialogueRecallLaneStatus 一致：BM25 / 向量单路状态 */
export interface DialogueRecallLaneStatus {
  status: string
  candidate_count: number
  detail?: string | null
  embedding_model?: string | null
}

export interface DialogueRecallResponse {
  user_query: string
  recall_method: string
  query_terms: string[]
  files_scanned: number
  recall_hits: DialogueRecallHit[]
  bm25: DialogueRecallLaneStatus
  vector: DialogueRecallLaneStatus
  injected_context: string
  context_truncated: boolean
  message: string
}

export interface DialogueRecallTestResponse {
  model: string
  usage?: TaskUsage
  user_query: string
  recall_method: string
  query_terms: string[]
  files_scanned: number
  recall_hits: DialogueRecallHit[]
  bm25: DialogueRecallLaneStatus
  vector: DialogueRecallLaneStatus
  injected_context: string
  context_truncated: boolean
  assistant_reply: string
  message: string
}

export interface RecallStopwordsResponse {
  words: string[]
  source: string
  runtime_path: string
  count: number
  message: string
}

export interface RecallStopwordsUpdateRequest {
  words: string[]
}

export interface WikiEmbedResponse {
  path: string
  chunk_count: number
  model: string
  updated_at: string
  message: string
}

/** 与后端 DataFolderTreeNode 一致 */
export interface DataFolderTreeNode {
  path: string
  title: string
  children: DataFolderTreeNode[]
}

export interface DataStructureFolderOpResponse {
  ok: boolean
  layer: LayerName
  path: string
}

export interface DataStructureFolderCreateRequest {
  layer: LayerName
  name: string
}

export interface DataStructureFolderRenameRequest {
  layer: LayerName
  path: string
  new_name: string
}
