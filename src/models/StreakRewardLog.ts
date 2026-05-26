import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface StreakRewardLogAttributes {
  id: number;
  userId: number;
  localDate: string;
  streakDay: number;
  baseReward: number;
  bonusReward: number;
  totalReward: number;
  submissionId?: number | null;
}

interface StreakRewardLogCreationAttributes
  extends Optional<StreakRewardLogAttributes, 'id' | 'submissionId'> {}

class StreakRewardLog
  extends Model<StreakRewardLogAttributes, StreakRewardLogCreationAttributes>
  implements StreakRewardLogAttributes
{
  public id!: number;
  public userId!: number;
  public localDate!: string;
  public streakDay!: number;
  public baseReward!: number;
  public bonusReward!: number;
  public totalReward!: number;
  public submissionId?: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

StreakRewardLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    localDate: { type: DataTypes.STRING(10), allowNull: false },
    streakDay: { type: DataTypes.INTEGER, allowNull: false },
    baseReward: { type: DataTypes.INTEGER, allowNull: false },
    bonusReward: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalReward: { type: DataTypes.INTEGER, allowNull: false },
    submissionId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'streak_reward_logs',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'localDate'],
        name: 'streak_reward_unique_user_date',
      },
    ],
  }
);

export default StreakRewardLog;
