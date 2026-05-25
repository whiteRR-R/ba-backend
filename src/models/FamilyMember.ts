import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type Relation =
  | 'self' | 'father' | 'mother' | 'brother' | 'sister'
  | 'grandfather' | 'grandmother' | 'son' | 'daughter'
  | 'husband' | 'wife' | 'uncle' | 'aunt' | 'cousin' | 'other';

interface FamilyMemberAttributes {
  id: number;
  userId: number;         // кому принадлежит дерево
  name: string;
  relation: Relation;
  birthYear?: number;
  bio?: string;
  avatarUrl?: string;
  parentId?: number;      // ссылка на родителя в дереве
  appUserId?: number;     // если этот родственник тоже есть в приложении
}

interface FamilyMemberCreationAttributes
  extends Optional<FamilyMemberAttributes, 'id' | 'birthYear' | 'bio' | 'avatarUrl' | 'parentId' | 'appUserId'> {}

class FamilyMember extends Model<FamilyMemberAttributes, FamilyMemberCreationAttributes>
  implements FamilyMemberAttributes {
  public id!: number;
  public userId!: number;
  public name!: string;
  public relation!: Relation;
  public birthYear?: number;
  public bio?: string;
  public avatarUrl?: string;
  public parentId?: number;
  public appUserId?: number;
  public readonly createdAt!: Date;
}

FamilyMember.init(
  {
    id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId:    { type: DataTypes.INTEGER, allowNull: false },
    name:      { type: DataTypes.STRING(100), allowNull: false },
    relation:  { type: DataTypes.STRING(50), allowNull: false },
    birthYear: { type: DataTypes.INTEGER, allowNull: true },
    bio:       { type: DataTypes.TEXT, allowNull: true },
    avatarUrl: { type: DataTypes.STRING(500), allowNull: true },
    parentId:  { type: DataTypes.INTEGER, allowNull: true },
    appUserId: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: 'family_members', timestamps: true }
);

export default FamilyMember;