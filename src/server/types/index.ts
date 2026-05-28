export interface CreateAppRequest {
  name: string
  url: string
  description?: string
}

export interface UpdateAppRequest {
  name?: string
  url?: string
  description?: string
}

export interface AppResponse {
  id: number
  name: string
  url: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ErrorResponse {
  error: string
}
