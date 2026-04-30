import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export interface ICategoryDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  parent: Types.ObjectId | null;
  ancestors: Types.ObjectId[];
  isActive: boolean;
  isDeleted: boolean;      // [NEW] soft-delete flag
  deletedAt: Date | null;  // [NEW] when it was soft-deleted
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryModel extends Model<ICategoryDocument> {}

const CategorySchema = new Schema<ICategoryDocument, ICategoryModel>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      minlength: [1, 'Category name must not be empty'],
      maxlength: [100, 'Category name must not exceed 100 characters'],
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    ancestors: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // [NEW] soft-delete fields
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id.toString(), ...rest };
      }
    },
  }
);

// Compound index for fast ancestor-based queries
CategorySchema.index({ ancestors: 1 });
CategorySchema.index({ parent: 1, isActive: 1 });
CategorySchema.index({ isDeleted: 1, isActive: 1 }); // [NEW] combined status index
CategorySchema.index({ name: 'text' });

export const Category = mongoose.model<ICategoryDocument, ICategoryModel>(
  'Category',
  CategorySchema
);
