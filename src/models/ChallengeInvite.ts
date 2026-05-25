import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ChallengeInviteAttributes {
  id: number;
  challengeId: number;
  fromUserId: number;
  toUserId: number;
  status: 'pending' | 'accepted' | 'rejected';
}

interface ChallengeInviteCreationAttributes
  extends Optional<ChallengeInviteAttributes, 'id' | 'status'> {}

class ChallengeInvite extends Model<ChallengeInviteAttributes, ChallengeInviteCreationAttributes>
  implements ChallengeInviteAttributes {
  public id!: number;
  public challengeId!: number;
  public fromUserId!: number;
  public toUserId!: number;
  public status!: 'pending' | 'accepted' | 'rejected';
  public readonly createdAt!: Date;
}

ChallengeInvite.init(
  {
    id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    challengeId: { type: DataTypes.INTEGER, allowNull: false },
    fromUserId:  { type: DataTypes.INTEGER, allowNull: false },
    toUserId:    { type: DataTypes.INTEGER, allowNull: false },
    status:      { type: DataTypes.ENUM('pending', 'accepted', 'rejected'), defaultValue: 'pending' },
  },
  { sequelize, tableName: 'challenge_invites', timestamps: true }
);

export default ChallengeInvite;