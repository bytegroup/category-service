import { Types } from 'mongoose';

export interface CategoryDocument {
  _id: Types.ObjectId;
  name: string;
  parent: Types.ObjectId | null;
  ancestors: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  name: string;
  parentId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
}

export interface CategoryResponse {
  id: string;
  name: string;
  parent: CategoryResponse | null;
  ancestors: CategoryResponse[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}
