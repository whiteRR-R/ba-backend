import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SpinHistoryAttributes {
  id: number;
  userId: number;
  spinType: 'free';
  reward: number;
  nextAvailableAt: Date;
}

interface SpinHistoryCreationAttributes extends Optional<SpinHistoryAttributes, 'id'> {}

class SpinHistory
  extends Model<SpinHistoryAttributes, SpinHistoryCreationAttributes>
  implements SpinHistoryAttributes
{
  public id!: number;
  public userId!: number;
  public spinType!: 'free';
  public reward!: number;
  public nextAvailableAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SpinHistory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    spinType: {
      type: DataTypes.ENUM('free'),
      allowNull: false,
      defaultValue: 'free',
    },
    reward: { type: DataTypes.INTEGER, allowNull: false },
    nextAvailableAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'spin_history',
    timestamps: true,
    indexes: [{ fields: ['userId', 'createdAt'] }],
  }
);

export default SpinHistory;
