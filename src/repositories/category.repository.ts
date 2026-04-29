import { Types, ClientSession } from 'mongoose';
import {Category, ICategoryDocument} from "@/models/category.model";
import {CreateCategoryInput, UpdateCategoryInput} from "@/types";


export class CategoryRepository {
  async findById(id: string): Promise<ICategoryDocument | null> {
    return Category.findById(id).populate('ancestors', 'name isActive').exec();
  }

  async findByName(name: string): Promise<ICategoryDocument | null> {
    return Category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } })
      .populate('ancestors', 'name isActive')
      .exec();
  }

  async findAll(
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: ICategoryDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Category.find()
        .populate('ancestors', 'name isActive')
        .populate('parent', 'name isActive')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Category.countDocuments(),
    ]);
    return { data, total };
  }

  async findChildren(parentId: string): Promise<ICategoryDocument[]> {
    return Category.find({ parent: new Types.ObjectId(parentId) })
      .populate('ancestors', 'name isActive')
      .exec();
  }

  async findDescendants(categoryId: string): Promise<ICategoryDocument[]> {
    return Category.find({ ancestors: new Types.ObjectId(categoryId) }).exec();
  }

  async create(
    input: CreateCategoryInput & { ancestors: Types.ObjectId[] },
    session?: ClientSession
  ): Promise<ICategoryDocument> {
    const [category] = await Category.create(
      [
        {
          name: input.name,
          parent: input.parentId ? new Types.ObjectId(input.parentId) : null,
          ancestors: input.ancestors,
          isActive: true,
        },
      ],
      { session }
    );
    return category;
  }

  async update(
    id: string,
    input: UpdateCategoryInput,
    session?: ClientSession
  ): Promise<ICategoryDocument | null> {
    return Category.findByIdAndUpdate(
      id,
      { $set: input },
      { new: true, runValidators: true, session }
    )
      .populate('ancestors', 'name isActive')
      .exec();
  }

  async deactivate(id: string, session?: ClientSession): Promise<ICategoryDocument | null> {
    return Category.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true, session }
    ).exec();
  }

  async deactivateDescendants(
    categoryId: string,
    session?: ClientSession
  ): Promise<number> {
    const result = await Category.updateMany(
      { ancestors: new Types.ObjectId(categoryId) },
      { $set: { isActive: false } },
      { session }
    );
    return result.modifiedCount;
  }

  async delete(id: string, session?: ClientSession): Promise<boolean> {
    const result = await Category.findByIdAndDelete(id, { session });
    return result !== null;
  }

  async deleteDescendants(
    categoryId: string,
    session?: ClientSession
  ): Promise<number> {
    const result = await Category.deleteMany(
      { ancestors: new Types.ObjectId(categoryId) },
      { session }
    );
    return result.deletedCount;
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    const query: Record<string, unknown> = {
      name: { $regex: `^${name}$`, $options: 'i' },
    };
    if (excludeId) query._id = { $ne: new Types.ObjectId(excludeId) };
    const count = await Category.countDocuments(query);
    return count > 0;
  }

  async getDepth(categoryId: string): Promise<number> {
    const category = await Category.findById(categoryId)
      .select('ancestors')
      .exec();
    return category ? category.ancestors.length : 0;
  }
}

export const categoryRepository = new CategoryRepository();
