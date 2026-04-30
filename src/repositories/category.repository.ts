import { Types, ClientSession } from 'mongoose';
import {Category, ICategoryDocument} from "@/models/category.model";
import {CreateCategoryInput, UpdateCategoryInput} from "@/types";

const ACTIVE_FILTER = { isDeleted: false };

export class CategoryRepository {
  async findById(id: string): Promise<ICategoryDocument | null> {
    return Category.findOne({ _id: id, ...ACTIVE_FILTER })
      .populate('ancestors', 'name isActive')
      .exec();
  }

  async findByName(name: string): Promise<ICategoryDocument | null> {
    return Category.findOne({
      name: { $regex: `^${name}$`, $options: 'i' },
      ...ACTIVE_FILTER,
    })
      .populate('ancestors', 'name isActive')
      .exec();
  }

  async findAll(
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: ICategoryDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Category.find(ACTIVE_FILTER)
        .populate('ancestors', 'name isActive')
        .populate('parent', 'name isActive')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Category.countDocuments(ACTIVE_FILTER),
    ]);
    return { data, total };
  }

  async findChildren(parentId: string): Promise<ICategoryDocument[]> {
    return Category.find({ parent: new Types.ObjectId(parentId), ...ACTIVE_FILTER })
      .populate('ancestors', 'name isActive')
      .exec();
  }

  async findManyByIds(ids: readonly string[]): Promise<(ICategoryDocument | null)[]> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const categories = await Category.find({
      _id: { $in: objectIds },
      ...ACTIVE_FILTER,
    }).exec();

    const map = new Map(categories.map((c) => [c._id.toString(), c]));
    return ids.map((id) => map.get(id) ?? null);
  }

  async findDescendants(categoryId: string): Promise<ICategoryDocument[]> {
    return Category.find({
      ancestors: new Types.ObjectId(categoryId),
      ...ACTIVE_FILTER,
    }).exec();
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
          isDeleted: false,
          deletedAt: null,
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
    return Category.findOneAndUpdate(
      { _id: id, ...ACTIVE_FILTER },
      { $set: input },
      { returnDocument: 'after', runValidators: true, session }
    )
      .populate('ancestors', 'name isActive')
      .exec();
  }

  async deactivate(id: string, session?: ClientSession): Promise<ICategoryDocument | null> {
    return Category.findOneAndUpdate(
      { _id: id, ...ACTIVE_FILTER },
      { $set: { isActive: false } },
      { returnDocument: 'after', session }
    ).exec();
  }

  async deactivateDescendants(categoryId: string, session?: ClientSession): Promise<number> {
    const result = await Category.updateMany(
      { ancestors: new Types.ObjectId(categoryId), ...ACTIVE_FILTER },
      { $set: { isActive: false } },
      { session }
    );
    return result.modifiedCount;
  }

  async softDelete(id: string, session?: ClientSession): Promise<ICategoryDocument | null> {
    return Category.findOneAndUpdate(
      { _id: id, ...ACTIVE_FILTER },
      { $set: { isDeleted: true, isActive: false, deletedAt: new Date() } },
      { returnDocument: 'after', session }
    ).exec();
  }

  async softDeleteDescendants(categoryId: string, session?: ClientSession): Promise<number> {
    const result = await Category.updateMany(
      { ancestors: new Types.ObjectId(categoryId), ...ACTIVE_FILTER },
      { $set: { isDeleted: true, isActive: false, deletedAt: new Date() } },
      { session }
    );
    return result.modifiedCount;
  }

  // [NEW] Restore a soft-deleted category
  async restore(id: string, session?: ClientSession): Promise<ICategoryDocument | null> {
    return Category.findOneAndUpdate(
      { _id: id, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null, isActive: true } },
      { returnDocument: 'after', session }
    ).exec();
  }

  // [NEW] Find soft-deleted categories (for admin/audit purposes)
  async findDeleted(page: number = 1, limit: number = 20): Promise<{ data: ICategoryDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Category.find({ isDeleted: true }).sort({ deletedAt: -1 }).skip(skip).limit(limit).exec(),
      Category.countDocuments({ isDeleted: true }),
    ]);
    return { data, total };
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    const query: Record<string, unknown> = {
      name: { $regex: `^${name}$`, $options: 'i' },
      ...ACTIVE_FILTER,
    };
    if (excludeId) query._id = { $ne: new Types.ObjectId(excludeId) };
    const count = await Category.countDocuments(query);
    return count > 0;
  }
}

export const categoryRepository = new CategoryRepository();
