import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

type InviteStatus = 'pending' | 'accepted' | 'rejected';

interface FamilyInviteAttributes {
  id: number;
  fromUserId: number;   // кто приглашает
  toUserId: number;     // кого приглашают
  relation: string;     // роль приглашаемого
  parentId?: number;    // к кому привязан в дереве
  birthYear?: number;
  status: InviteStatus;
}

interface FamilyInviteCreationAttributes
  extends Optional<FamilyInviteAttributes, 'id' | 'parentId' | 'birthYear' | 'status'> {}

class FamilyInvite extends Model<FamilyInviteAttributes, FamilyInviteCreationAttributes>
  implements FamilyInviteAttributes {
  public id!: number;
  public fromUserId!: number;
  public toUserId!: number;
  public relation!: string;
  public parentId?: number;
  public birthYear?: number;
  public status!: InviteStatus;
  public readonly createdAt!: Date;
}

FamilyInvite.init(
  {
    id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    fromUserId: { type: DataTypes.INTEGER, allowNull: false },
    toUserId:   { type: DataTypes.INTEGER, allowNull: false },
    relation:   { type: DataTypes.STRING(50), allowNull: false },
    parentId:   { type: DataTypes.INTEGER, allowNull: true },
    birthYear:  { type: DataTypes.INTEGER, allowNull: true },
    status:     { type: DataTypes.ENUM('pending', 'accepted', 'rejected'), defaultValue: 'pending' },
  },
  { sequelize, tableName: 'family_invites', timestamps: true }
);

export default FamilyInvite;