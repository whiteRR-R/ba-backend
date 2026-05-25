import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { ChallengeStatus, VisibilityLevel } from '../types';

interface ChallengeAttributes {
  id: number;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  creatorId: number;
  status: ChallengeStatus;
  visibility: VisibilityLevel;
  betAmount: number;
  familyOwnerId?: number;
}

interface ChallengeCreationAttributes
  extends Optional<ChallengeAttributes, 'id' | 'status' | 'betAmount'> { }

class Challenge extends Model<ChallengeAttributes, ChallengeCreationAttributes>
  implements ChallengeAttributes {
  public id!: number;
  public title!: string;
  public description!: string;
  public startDate!: Date;
  public endDate!: Date;
  public creatorId!: number;
  public status!: ChallengeStatus;
  public visibility!: VisibilityLevel;
  public betAmount!: number;
  public familyOwnerId: any;

  // ✅ Добавляем updatedAt — нужен для cleanupFiles
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Challenge.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    startDate: { type: DataTypes.DATE, allowNull: false },
    endDate: { type: DataTypes.DATE, allowNull: false },
    creatorId: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM('active', 'pending', 'completed', 'cancelled'),
      defaultValue: 'pending',
    },
    visibility: {
      type: DataTypes.ENUM('secret', 'protected', 'public'),
      defaultValue: 'protected',
    },
    betAmount: { type: DataTypes.INTEGER, defaultValue: 0 },
    familyOwnerId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'challenges',
    timestamps: true,   // ✅ включает createdAt и updatedAt
  }
);

export default Challenge;