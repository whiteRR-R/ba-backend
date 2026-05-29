import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ChallengeKickAttributes {
  id: number;
  challengeId: number;
  userId: number;
  kickedByUserId: number;
  reason?: string | null;
  kickedAt: Date;
}

interface ChallengeKickCreationAttributes
  extends Optional<ChallengeKickAttributes, 'id' | 'reason' | 'kickedAt'> {}

class ChallengeKick
  extends Model<ChallengeKickAttributes, ChallengeKickCreationAttributes>
  implements ChallengeKickAttributes
{
  public id!: number;
  public challengeId!: number;
  public userId!: number;
  public kickedByUserId!: number;
  public reason?: string | null;
  public kickedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ChallengeKick.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    challengeId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    kickedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING(300), allowNull: true },
    kickedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'challenge_kicks',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['challengeId', 'userId'],
        name: 'challenge_kicks_unique_challenge_user',
      },
      { fields: ['challengeId'] },
      { fields: ['userId'] },
    ],
  }
);

export default ChallengeKick;

